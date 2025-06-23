// Copy to clipboard functionality for code blocks
document.addEventListener('DOMContentLoaded', function() {
    // Add copy buttons to all pre elements
    const preElements = document.querySelectorAll('pre');
    
    preElements.forEach(function(pre) {
        // Skip if already has a copy button
        if (pre.querySelector('.copy-button')) {
            return;
        }
        
        // Create copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.setAttribute('aria-label', 'Copy code to clipboard');
        
        // Add click handler
        copyButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the code content
            const code = pre.querySelector('code');
            const textToCopy = code ? code.textContent : pre.textContent;
            
            // Copy to clipboard
            navigator.clipboard.writeText(textToCopy).then(function() {
                // Show success feedback
                copyButton.textContent = 'Copied!';
                copyButton.classList.add('copied');
                
                // Reset button after 2 seconds
                setTimeout(function() {
                    copyButton.textContent = 'Copy';
                    copyButton.classList.remove('copied');
                }, 2000);
            }).catch(function(err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    copyButton.textContent = 'Copied!';
                    copyButton.classList.add('copied');
                    
                    setTimeout(function() {
                        copyButton.textContent = 'Copy';
                        copyButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy: ', err);
                    copyButton.textContent = 'Failed';
                    
                    setTimeout(function() {
                        copyButton.textContent = 'Copy';
                    }, 2000);
                }
                
                document.body.removeChild(textArea);
            });
        });
        
        // Append button to pre element
        pre.appendChild(copyButton);
    });
});
