export default await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/showdown/2.1.0/showdown.min.js';
    document.head.appendChild(script);
    script.onload = function () {
        resolve(showdown);
    }
    script.onerror = reject;
})
