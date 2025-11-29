export async function jsonToClipboard(obj) {
    navigator.clipboard.writeText(toJson(obj));
}

export function getError(e) {
    const prefix = "⚠️ Failed: ";
    let errorMessage = "unknown reason";
    let fullErrorObject = null;

    if (e.response?.data) {
        const data = e.response.data;

        if (data.error) {
            const error = data.error;
            fullErrorObject = error; // Store for detailed log

            // Priority 1: Database errors - sqlMessage is cleanest
            if (error.sqlMessage) {
                errorMessage = error.sqlMessage;
            }
            // Priority 2: Extract meaningful part from message
            else if (error.message) {
                if (typeof error.message === "string" && error.message.includes(" - ")) {
                    const parts = error.message.split(" - ");
                    errorMessage = parts[parts.length - 1];
                } else {
                    errorMessage = String(error.message);
                }
            }
            // Priority 3: Directus error format
            else if (error.extensions?.reason) {
                errorMessage = error.extensions.reason;
            }
            // Priority 4: Error code with message
            else if (error.code) {
                errorMessage = `Error ${error.code}: ${error.message || "An error occurred"
                    }`;
            }
            // Priority 5: Error as string
            else if (typeof error === "string") {
                errorMessage = error;
            }
            // Priority 6: Fallback
            else {
                errorMessage = JSON.stringify(error);
            }
        } else if (data.message) {
            errorMessage = data.message;
            fullErrorObject = data;
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
                if (Object.prototype.hasOwnProperty.call(value, key)) {
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
