const fs = require('fs');
let content = fs.readFileSync('src/data/seedData.ts', 'utf8');

// Fix duplicated defaultMarkup and unit
content = content.replace(/defaultMarkup: \d+,\n\s+defaultMarkup: 35, unit: "ea", sellingPrice:/g, (match) => {
  return match.replace(/defaultMarkup: 35, unit: "ea", /, '');
});

// Fix quantity vs stockQty in QuoteLineItem (around line 849+)
// Actually, let's just find the `initialQuotes` and `initialInvoices` sections and replace `stockQty:` back with `quantity:`
const quotesStart = content.indexOf('export const initialQuotes');
if (quotesStart !== -1) {
  const beforeQuotes = content.substring(0, quotesStart);
  const afterQuotes = content.substring(quotesStart).replace(/stockQty:/g, 'quantity:');
  content = beforeQuotes + afterQuotes;
}

fs.writeFileSync('src/data/seedData.ts', content);
