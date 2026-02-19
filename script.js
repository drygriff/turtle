const copyButton = document.querySelector("[data-copy-button]");
const codeElement = document.querySelector("[data-copy-code]");

if (copyButton && codeElement) {
  const code = codeElement.textContent.trim();
  const defaultLabel = copyButton.textContent;

  copyButton.addEventListener("click", () => {
    copyToClipboard(code)
      .then(() => {
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
          copyButton.textContent = defaultLabel;
        }, 1400);
      })
      .catch(() => {
        copyButton.textContent = "Copy failed";
        window.setTimeout(() => {
          copyButton.textContent = defaultLabel;
        }, 1400);
      });
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}
