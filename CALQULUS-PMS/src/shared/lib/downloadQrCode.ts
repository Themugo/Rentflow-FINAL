/**
 * Utility function to convert a rendered QRCodeSVG element to a PNG file and trigger download.
 */
export function downloadQrCodeAsPng(svgId: string, fileName: string = 'qr-code.png'): boolean {
  const svgElement = document.getElementById(svgId) as SVGElement | null;
  if (!svgElement) return false;

  try {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      // 3x scale for crisp, high-resolution PNG output
      const scale = 3;
      const width = (svgElement.clientWidth || 180) * scale;
      const height = (svgElement.clientHeight || 180) * scale;
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const png = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = png;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
    return true;
  } catch (err) {
    console.error('Error downloading QR code:', err);
    return false;
  }
}
