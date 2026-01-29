
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const markdownpdf = require("markdown-pdf");
const fs = require("fs");

const mdDocs = ["MANUAL_USUARIO.md"];
const bookPath = "MANUAL_USUARIO.pdf";

markdownpdf()
    .from(mdDocs)
    .to(bookPath, function () {
        console.log("PDF creado exitosamente: " + bookPath);
    });
