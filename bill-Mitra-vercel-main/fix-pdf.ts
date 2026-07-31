import fs from 'fs';
let content = fs.readFileSync('src/pages/InvoiceDetailPage.tsx', 'utf8');

const newHandlePdf = `
  const handlePdf = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const { url, html } = await generateInvoicePdf({ invoiceId: id }) as any;
      if (html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          // Give it a moment to load styles/images
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        } else {
          toast.error("Popup blocked. Please allow popups to print.");
        }
      } else if (url) {
        window.open(url, '_blank');
      }
    } catch { toast.error('Failed to generate PDF'); }
    finally { setGenerating(false); }
  };
`;

content = content.replace(/const handlePdf = async \(\) => \{[\s\S]*?\};/, newHandlePdf.trim());
content = content.replace("<Download className=\"w-4 h-4 mr-2\" />{generating ? 'Generating...' : 'Download PDF'}", "<FileText className=\"w-4 h-4 mr-2\" />{generating ? 'Generating...' : 'Print / Save PDF'}");

fs.writeFileSync('src/pages/InvoiceDetailPage.tsx', content);
