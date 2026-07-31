import fs from 'fs';
let html = `
<!doctype html>
<html>
<head>
<style>
table { border-collapse: collapse; width: 100%; height: 500px; }
th, td { border: 1px solid black; }
.items-table td { border-top: none; border-bottom: none; vertical-align: top; }
.item-row td { border-bottom: 1px solid black !important; }
</style>
</head>
<body>
<table class="items-table">
  <thead><tr><th>A</th><th>B</th></tr></thead>
  <tbody>
    <tr class="item-row"><td>1</td><td>2</td></tr>
    <tr class="item-row"><td>3</td><td>4</td></tr>
    <tr class="filler-row"><td style="border-bottom: none !important;"></td><td style="border-bottom: none !important;"></td></tr>
  </tbody>
</table>
</body>
</html>
`;
fs.writeFileSync('test.html', html);
console.log('done');
