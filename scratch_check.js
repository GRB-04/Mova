const fs = require('fs');

// Read PNG header and palette/IDAT or basic chunks
const buf = fs.readFileSync('c:/Mova/assets/mova-logo.png');
console.log('PNG size:', buf.length);

// Let's use PowerShell via clean execution without inline code
