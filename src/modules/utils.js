export async function jsonToClipboard(obj) {
    navigator.clipboard.writeText(toJson(obj));
}

function extractErrorMessageFromError(error) {
    // Priority 1: Database errors - sqlMessage is cleanest
    if (error.sqlMessage) {
        return error.sqlMessage;
    }

    // Priority 2: Extract meaningful part from message
    if (error.message) {
        if (typeof error.message === "string" && error.message.includes(" - ")) {
            const parts = error.message.split(" - ");
            return parts[parts.length - 1];
        }
        return String(error.message);
    }

    // Priority 3: Directus error format
    if (error.extensions?.reason) {
        return error.extensions.reason;
    }

    // Priority 4: Error code with message
    if (error.code) {
        return `Error ${error.code}: ${error.message || "An error occurred"}`;
    }

    // Priority 5: Error as string
    if (typeof error === "string") {
        return error;
    }

    // Priority 6: Fallback
    return JSON.stringify(error);
}

function extractErrorMessageFromResponse(responseData) {
    if (responseData.error) {
        return {
            message: extractErrorMessageFromError(responseData.error),
            fullError: responseData.error
        };
    }

    if (responseData.message) {
        return {
            message: responseData.message,
            fullError: responseData
        };
    }

    return null;
}

export function getError(e) {
    const prefix = "⚠️ Failed: ";
    let errorMessage = "unknown reason";
    let fullErrorObject = null;

    if (e.response?.data) {
        const extracted = extractErrorMessageFromResponse(e.response.data);
        if (extracted) {
            errorMessage = extracted.message;
            fullErrorObject = extracted.fullError;
        }
    } else if (e.message) {
        errorMessage = e.message;
        fullErrorObject = e;
    }

    // Build result with detailed log
    let result = prefix + errorMessage;
    if (fullErrorObject) {
        result += "\n\nDetailed Error Log:\n" + toJson(fullErrorObject);
    }

    return result;
}

export function toJson(obj) {
    const path = []; // Track current traversal path to detect circular references

    function serialize(value) {
        // Only check objects/arrays
        if (typeof value !== "object" || value === null) {
            return value;
        }

        // Check if this object is in the current path (circular reference)
        if (path.includes(value)) {
            return "[Circular]";
        }

        // Add to path
        path.push(value);

        try {
            // Handle arrays
            if (Array.isArray(value)) {
                return value.map(item => serialize(item));
            }

            // Handle objects
            const result = {};
            for (const key in value) {
                if (Object.hasOwn(value, key)) {
                    result[key] = serialize(value[key]);
                }
            }
            return result;
        } finally {
            // Remove from path when done (allows same object to appear elsewhere)
            const index = path.indexOf(value);
            if (index > -1) {
                path.splice(index, 1);
            }
        }
    }

    try {
        const serialized = serialize(obj);
        return JSON.stringify(serialized, null, "\t");
    } catch (e) {
        // Fallback if serialization still fails
        return String(obj);
    }
}
