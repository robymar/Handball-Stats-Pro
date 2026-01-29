
const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('Reglas-de-Juego-Julio-2025.pdf');

pdf(dataBuffer).then(function (data) {
    console.log('Total Pages:', data.numpages);
    console.log('--- START PREVIEW ---');
    console.log(data.text.substring(0, 1000));
    console.log('--- END PREVIEW ---');

    fs.writeFileSync('pdf_content.txt', data.text);
    console.log('Finished.');
}).catch(err => {
    console.error("Error:", err);
});
