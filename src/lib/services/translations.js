import pick from "lodash/pick";
import {
    getEnvConfig,
    getSyncFilePath,
    partitionCreateUpdate,
    readJson,
    writeJson,
    HP
} from "../helpers.js";

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

    const translationsData = await getCurrentTranslations(translationsService, emitter);

    const translationsFilePath = getSyncFilePath(
        "translations",
        version,
        currentTimeStamp
    );
    writeJson(translationsFilePath, translationsData);

    // TODO implement hook

    return translationsData;
}

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

    const currentTranslations = await getCurrentTranslations(translationsService, emitter);

    /**
     *
     * Get separate lists of what to
     * create and what to update
     */
    const [initialTranslationsInput, existingTranslationsInput] =
        partitionCreateUpdate(translationsFromFile, currentTranslations);

    if (!dryRun) {
        await translationsService.createMany(
            initialTranslationsInput
        );
        await Promise.all(
            existingTranslationsInput.map(async (t) => {
                // Directus effectively only allows us to update value, may be a bug?
                return await translationsService.updateOne(t.id, pick(t, "value"));
            })
        );
    }

    return {
        created: initialTranslationsInput,
        updated: existingTranslationsInput,
    };
}

export async function getCurrentTranslations(translationsService, emitter) {
    const translations = await translationsService.readByQuery({
        limit: -1,
    });
    const filteredTranslations = await emitter.emitFilter(`${HP}.translations.pull`, translations);
    return filteredTranslations;
}