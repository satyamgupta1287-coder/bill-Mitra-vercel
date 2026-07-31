import fs from 'fs';
let content = fs.readFileSync('src/pages/InvoicesPage.tsx', 'utf8');

const newHandlers = `
  const handleDownload = async (invoiceId: string) => {
    setGeneratingId(invoiceId);
    try {
      const { url, html } = await generateInvoicePdf({ invoiceId }) as any;
      if (html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
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
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePrint = handleDownload;
`;

content = content.replace(/const handleDownload = async [\s\S]*?const handlePrint = async [\s\S]*?\}\n  \};/, newHandlers.trim());

fs.writeFileSync('src/pages/InvoicesPage.tsx', content);
