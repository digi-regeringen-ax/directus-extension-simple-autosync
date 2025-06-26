import pick from "lodash/pick";
import {
    getEnvConfig,
    getSyncFilePath,
    partitionCreateUpdate,
    readJson,
    writeJson,
    HP,
} from "../helpers.js";

/**
 * Pulls translations from the Directus services and saves them to a file.
 * @async
 * @param {Object} services - The services object containing TranslationsService.
 * @param {Object} schema - The schema object.
 * @param {Object} emitter - The event emitter for filtering data.
 * @param {Object} accountability - The accountability object for services.
 * @param {string} version - The currently running Directus version.
 * @param {string} currentTimeStamp - The timestamp for the translations file.
 * @returns {Promise<Object>} The translations data that was saved to the file.
 */
export async function pullTranslations(
    services,
    schema,
    emitter,
    accountability,
    version,
    currentTimeStamp
) {
    const { TranslationsService } = services;
    const translationsService = new TranslationsService({
        accountability,
        schema,
    });

    const translationsData = await getCurrentTranslations(
        translationsService,
        emitter
    );

    const translationsFilePath = getSyncFilePath(
        "translations",
        version,
        currentTimeStamp
    );
    writeJson(translationsFilePath, translationsData);

    // TODO implement hook

    return translationsData;
}

/**
 * Pushes translations from a file to the Directus services.
 * @async
 * @param {Object} services - The services object containing TranslationsService.
 * @param {Object} schema - The schema object.
 * @param {Object} emitter - The event emitter for filtering data.
 * @param {Object} accountability - The accountability object for services.
 * @param {boolean} [dryRun=false] - If true, the function will not apply changes.
 * @param {string} version - The currently running Directus version.
 * @returns {Promise<Object>} An object detailing the changes made to translations.
 * @throws {Error} If translations functionality is not enabled.
 */
export async function pushTranslations(
    services,
    schema,
    emitter,
    accountability,
    dryRun = false,
    version
) {
    const { TranslationsService } = services;
    const translationsService = new TranslationsService({
        accountability,
        schema,
    });

    if (!getEnvConfig().AUTOSYNC_INCLUDE_TRANSLATIONS)
        throw new Error("Translations functionality not enabled");

    const translationsFilePath = getSyncFilePath("translations", version);
    const translationsFromFile = readJson(translationsFilePath);

    const currentTranslations = await getCurrentTranslations(
        translationsService,
        emitter
    );

    /**
     *
     * Get separate lists of what to
     * create and what to update
     */
    const [initialTranslationsInput, existingTranslationsInput] =
        partitionCreateUpdate(translationsFromFile, currentTranslations);

    if (!dryRun) {
        await translationsService.createMany(initialTranslationsInput);
        await Promise.all(
            existingTranslationsInput.map(async (t) => {
                // Directus effectively only allows us to update value, may be a bug?
                return await translationsService.updateOne(
                    t.id,
                    pick(t, "value")
                );
            })
        );
    }

    return {
        created: initialTranslationsInput,
        updated: existingTranslationsInput,
    };
}

/**
 * Retrieves the current translations from the Directus services.
 * @async
 * @param {Object} translationsService - The translations service instance.
 * @param {Object} emitter - The event emitter for filtering data.
 * @returns {Promise<Object>} The filtered current translations.
 */
export async function getCurrentTranslations(translationsService, emitter) {
    const translations = await translationsService.readByQuery({
        limit: -1,
    });
    const filteredTranslations = await emitter.emitFilter(
        `${HP}.translations.pull`,
        translations
    );
    return filteredTranslations;
}
