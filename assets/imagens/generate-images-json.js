const fs = require('fs');
const path = require('path');

const currentDir = __dirname;
const outputFile = 'images.json';
const thisFile = path.basename(__filename);

// extensões que você quer considerar como imagem (pode adicionar mais)
const allowedExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'
]);

function isImage(file) {
  return allowedExtensions.has(path.extname(file).toLowerCase());
}

const files = fs.readdirSync(currentDir);

const imageFiles = files
  .filter(file => {
    const fullPath = path.join(currentDir, file);
    return (
      fs.statSync(fullPath).isFile() &&
      file !== thisFile &&
      file !== outputFile &&
      isImage(file)
    );
  })
  .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

fs.writeFileSync(
  path.join(currentDir, outputFile),
  JSON.stringify(imageFiles, null, 2),
  'utf-8'
);

console.log(`✅ images.json criado com ${imageFiles.length} imagens.`);
