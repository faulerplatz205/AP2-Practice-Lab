import { defineText } from "./locale";

/** Errors while creating image files. */
export const fileText = defineText({
    imageFailed: "Bild konnte nicht erzeugt werden",
    pngFailed: "PNG fehlgeschlagen",
}, {
    imageFailed: "Could not create the image",
    pngFailed: "PNG failed",
});
