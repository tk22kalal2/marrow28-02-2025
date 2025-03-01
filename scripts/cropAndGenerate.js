const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "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";
let logs = [];

document.getElementById("generateQuestionBtn").addEventListener("click", handleGenerateQuestion);

async function handleGenerateQuestion() {
    logs = [];
    logMessage("Starting question generation process...");
    
    const outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("Please upload an image first!");
        logMessage("Error: No image found");
        return;
    }

    try {
        // Initialize image processing
        const img = new Image();
        img.src = outputImage.src;
        
        await new Promise((resolve) => {
            img.onload = resolve;
        });

        // OCR Processing
        logMessage("Initializing OCR...");
        const worker = Tesseract.createWorker();
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
        
        // Process image once for both cropping and text extraction
        logMessage("Processing image...");
        const { data: { text, words } } = await worker.recognize(img);
        await worker.terminate();

        // Crop question section
        logMessage("Detecting question section...");
        const optionsStartY = detectOptionsStart(words);
        if (optionsStartY === null) {
            alert("Could not find options in the image");
            logMessage("Error: Options not detected");
            return;
        }

        performCropping(img, 0, optionsStartY);
        document.getElementById("croppedQuestionContainer").style.display = "block";

        // Process text
        logMessage("Formatting extracted text...");
        await getFormattedQuestion(text);
        document.getElementById("questionFrame").style.display = "block";

    } catch (error) {
        logMessage(`Error: ${error.message}`);
        alert("An error occurred during processing");
    }
}

function performCropping(img, startY, endY) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const cropHeight = endY - startY;
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = canvas.width;
    croppedCanvas.height = cropHeight;
    
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCtx.drawImage(canvas, 0, startY, canvas.width, cropHeight, 0, 0, canvas.width, cropHeight);

    const croppedImage = new Image();
    croppedImage.src = croppedCanvas.toDataURL("image/png");
    document.getElementById("croppedOutput").innerHTML = "";
    document.getElementById("croppedOutput").appendChild(croppedImage);
}

function detectOptionsStart(words) {
    const optionMarkers = new Set(["A.", "B.", "C.", "D."]);
    for (let word of words) {
        if (optionMarkers.has(word.text.trim())) {
            return word.bbox.y0;
        }
    }
    return null;
}

async function getFormattedQuestion(text) {
    try {
        logMessage("Connecting to Groq API...");
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mixtral-8x7b-32768",
                messages: [{
                    role: "system",
                    content: "Extract and format as: Question: [question]\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer: [letter]\nExplanation: [text]"
                }, {
                    role: "user",
                    content: text
                }],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
            const formatted = data.choices[0].message.content;
            document.getElementById("generatedQuestion").textContent = formatted;
            logMessage("Successfully formatted question");
        } else {
            throw new Error("Invalid API response");
        }
    } catch (error) {
        logMessage(`API Error: ${error.message}`);
        throw error;
    }
}

// Logging functions
function logMessage(message) {
    logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    document.getElementById("logContent").textContent = logs.join("\n");
}

function showLogs() {
    document.getElementById("logModal").style.display = "block";
}

function closeLogModal() {
    document.getElementById("logModal").style.display = "none";
}
