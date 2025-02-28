const uploadImage = document.getElementById("uploadImage");
const processButton = document.getElementById("processButton");
const cropButton = document.getElementById("cropButton");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");
let uploadedImage = null;

// Handle image upload
uploadImage.addEventListener("change", (event) => {
    console.log("Uploading image...");

    const file = event.target.files[0];
    if (!file) {
        console.warn("No file selected. Please upload an image.");
        alert("No file selected. Please upload an image.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;

        img.onload = () => {
            console.log("Image uploaded successfully! Rendering on canvas...");
            uploadedImage = img;

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            processButton.disabled = false;
        };
    };

    reader.readAsDataURL(file);
});

// Handle process image
processButton.addEventListener("click", async () => {
    if (!uploadedImage) {
        console.error("No image uploaded yet. Please upload an image first.");
        alert("No image uploaded yet. Please upload an image first.");
        return;
    }

    try {
        console.log("Starting OCR process...");
        
        const worker = await Tesseract.createWorker("eng");

        console.log("OCR initialized successfully! Reading image text...");
        const { data: { words } } = await worker.recognize(uploadedImage);

        if (!words || words.length === 0) {
            console.warn("No text detected. Ensure the image contains readable text.");
            alert("No text detected. Ensure the image contains readable text.");
            return;
        }

        console.log("Detecting options and question...");

        const optionsStartY = detectOptionsStart(words);
        if (optionsStartY === null) {
            console.warn("No options detected. Check format.");
            alert("No options detected. Check format.");
            return;
        }

        const questionEndY = detectQuestionEnd(words, optionsStartY);
        if (questionEndY === null) {
            console.warn("No question end detected. Check format.");
            alert("No question end detected. Check format.");
            return;
        }

        // Handling Large Gap
        const gap = optionsStartY - questionEndY;
        console.log(`Detected Gap: ${gap} pixels`);
        if (gap > 500) {  // Adjust this threshold as needed
            console.warn("Large gap detected between question and options.");
            alert("Warning: Large gap detected between question and options.");
        }

        cropButton.dataset.startY = questionEndY;
        cropButton.dataset.endY = optionsStartY;
        cropButton.disabled = false;
        console.log("Processing completed! Click 'Crop' to crop the image.");

        await worker.terminate();
    } catch (error) {
        console.error("Error processing image:", error);
        alert("Error processing image. Check console.");
    }
});

// Handle cropping
cropButton.addEventListener("click", () => {
    const startY = parseInt(cropButton.dataset.startY);
    const endY = parseInt(cropButton.dataset.endY);
    performCropping(startY, endY);
});

function performCropping(startY, endY) {
    const cropHeight = endY - startY;
    if (cropHeight <= 0) {
        console.error("Invalid cropping height.");
        alert("Invalid cropping height.");
        return;
    }

    console.log(`Cropping image from Y=${startY} to Y=${endY} (Height: ${cropHeight})`);

    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCanvas.width = canvas.width;
    croppedCanvas.height = cropHeight;

    croppedCtx.drawImage(
        uploadedImage,
        0, startY, canvas.width, cropHeight,
        0, 0, canvas.width, cropHeight
    );

    const croppedImage = new Image();
    croppedImage.src = croppedCanvas.toDataURL("image/png");
    output.appendChild(croppedImage);
    console.log("Image cropped successfully!");
    alert("Image cropped successfully!");
}

function detectOptionsStart(words) {
    for (let i = 0; i < words.length; i++) {
        if (["A.", "B.", "C.", "D."].includes(words[i].text.trim())) {
            console.log(`Options start detected at Y=${words[i].bbox.y0}`);
            return words[i].bbox.y0;
        }
    }
    return null;
}

function detectQuestionEnd(words, optionsStartY) {
    let lastTextY = 0;
    for (let i = 0; i < words.length; i++) {
        const currentY = words[i].bbox.y1;
        if (currentY >= optionsStartY) break;
        lastTextY = currentY;
    }
    console.log(`Question end detected at Y=${lastTextY}`);
    return lastTextY;
}
