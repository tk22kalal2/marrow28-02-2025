function cropCurrentImage() {
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to crop!");
        return;
    }

    const img = new Image();
    img.src = outputImage.src;

    img.onload = async () => {
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const worker = Tesseract.createWorker();
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");

        const { data: { words } } = await worker.recognize(img);
        await worker.terminate();

        const optionsStartY = detectOptionsStart(words);
        if (optionsStartY === null) {
            alert("No options detected.");
            return;
        }

        performCropping(0, optionsStartY);
    };
}

function performCropping(startY, endY) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const cropHeight = endY - startY;

    if (cropHeight <= 0) {
        alert("Invalid cropping area.");
        return;
    }

    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCanvas.width = canvas.width;
    croppedCanvas.height = cropHeight;

    croppedCtx.drawImage(canvas, 0, startY, canvas.width, cropHeight, 0, 0, canvas.width, cropHeight);

    const output = document.getElementById("output");
    const croppedImage = new Image();
    croppedImage.src = croppedCanvas.toDataURL("image/png");
    output.innerHTML = "";
    output.appendChild(croppedImage);

    console.log("Cropped image displayed");
}

function detectOptionsStart(words) {
    for (let i = 0; i < words.length; i++) {
        if (["A.", "B.", "C.", "D."].includes(words[i].text.trim())) {
            return words[i].bbox.y0;
        }
    }
    return null;
}
