const fs = require('fs');
let content = fs.readFileSync('src/data/seedData.ts', 'utf8');

const quotesStart = content.indexOf('export const initialQuotes');
if (quotesStart !== -1) {
  const beforeQuotes = content.substring(0, quotesStart);
  const afterQuotes = content.substring(quotesStart).replace(/notes:/g, 'description:');
  content = beforeQuotes + afterQuotes;
}

fs.writeFileSync('src/data/seedData.ts', content);
