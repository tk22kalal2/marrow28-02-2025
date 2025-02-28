const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "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";

let croppedImages = [];
let currentIndex = 0;

function processImage() {
    const input = document.getElementById('imageUpload');
    if (!input.files.length) return alert("Please upload an image!");
    
    const img = new Image();
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    img.onload = function () {
        detectQuestions(img);
    };
}

function detectQuestions(img) {
    Tesseract.recognize(img, 'eng').then(({ data }) => {
        let positions = [];
        let textLines = data.lines;
        
        textLines.forEach((line) => {
            if (line.text.match(/^\d+\./)) {
                positions.push(line.bbox.y0);
            }
        });

        positions.push(img.height); // Add last position (end of image)
        console.log("Detected positions:", positions);
        splitImage(img, positions);
    });
}

function splitImage(img, positions) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    croppedImages = [];
    currentIndex = 0;
    
    for (let i = 0; i < positions.length - 1; i++) {
        let y1 = positions[i];
        let y2 = positions[i + 1];
        let height = y2 - y1;
        
        canvas.width = img.width;
        canvas.height = height;
        ctx.drawImage(img, 0, y1, img.width, height, 0, 0, img.width, height);
        
        croppedImages.push(canvas.toDataURL("image/png"));
    }
    console.log("Cropped images count:", croppedImages.length);
    showNextImage();
}

function showNextImage() {
    if (currentIndex < croppedImages.length) {
        let outputImage = document.getElementById("outputImage");
        outputImage.src = croppedImages[currentIndex];
        outputImage.style.display = "block";
        
        document.getElementById("cropBtn").style.display = "block";
        document.getElementById("nextBtn").style.display = currentIndex < croppedImages.length - 1 ? "block" : "none";
        document.getElementById("makeQuestionBtn").style.display = "block";
        document.getElementById("mergeMakeQuestionBtn").style.display = "block";
        
        console.log("Displaying cropped image", currentIndex + 1);
        currentIndex++;
    }
}

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
        if (!words || words.length === 0) {
            alert("No text detected. Ensure the image contains readable text.");
            return;
        }

        const optionsStartY = detectOptionsStart(words);
        console.log("Options start detected at:", optionsStartY);
        if (optionsStartY === null) {
            alert("No options detected. Ensure they are labeled as A., B., C., D.");
            return;
        }

        alert("Cropping above detected options start...");
        performCropping(0, optionsStartY);
        
        await worker.terminate();
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

    croppedCtx.drawImage(
        canvas, 
        0, startY, canvas.width, cropHeight, 
        0, 0, canvas.width, cropHeight
    );

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

async function mergeMakeQuestion() {
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to extract text!");
        return;
    }

    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const { data: { text } } = await worker.recognize(outputImage);
    await worker.terminate();

    if (!text.trim()) {
        alert("No text detected. Please use a clearer image.");
        return;
    }

    console.log("Extracted Text:", text);
    getFormattedQuestionWithImage(text, outputImage.src);
}

async function getFormattedQuestionWithImage(text, imageUrl) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "mixtral-8x7b-32768",
            messages: [
                { role: "system", content: "Extract and format the given text into a structured question format." },
                { role: "user", content: text }
            ],
            max_tokens: 300
        })
    });

    const result = await response.json();
    document.getElementById("generatedQuestion").innerHTML = `<img src="${imageUrl}" /><br>${result.choices[0].message.content}`;
}
