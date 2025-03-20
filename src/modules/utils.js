export async function jsonToClipboard(obj) {
    navigator.clipboard.writeText(toJson(obj));
}

export function getError(e) {
    const prefix = "⚠️ Failed: ";
    const plainMessage = e.message || "unknown reason";
    return (
        prefix + (e.response?.data?.error?.extensions?.reason || plainMessage)
    );
}

export function toJson(obj) {
    return JSON.stringify(obj, null, "\t");
}
