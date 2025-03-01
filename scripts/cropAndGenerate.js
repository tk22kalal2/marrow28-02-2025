const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "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";
let logs = [];

// Ensure the button exists before adding the event listener
document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById("generateQuestionBtn");
    if (generateBtn) {
        generateBtn.addEventListener("click", handleGenerateQuestion);
        console.log("✅ Event listener added to Generate Question button");
    } else {
        console.error("❌ Generate Question button not found!");
    }
});

async function handleGenerateQuestion() {
    console.log("🚀 Generate Question button clicked");
    logs = [];
    logMessage("🚀 Starting question generation process...");

    try {
        const outputImage = document.getElementById("outputImage");
        if (!outputImage || !outputImage.src) {
            logMessage("❌ Error: No image found or no source");
            alert("Please upload an image first!");
            return;
        }

        logMessage("🖼️ Loading image...");
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Handle cross-origin images
        img.src = outputImage.src;
        console.log("Image source:", img.src);

        // Wait for image to load
        await new Promise((resolve, reject) => {
            img.onload = () => {
                console.log("✅ Image loaded successfully");
                resolve();
            };
            img.onerror = () => {
                console.error("❌ Image failed to load");
                reject(new Error("Image load failed"));
            };
            if (img.complete) resolve(); // Handle cached images
        });

        // Initialize Tesseract OCR
        logMessage("🔧 Initializing Tesseract OCR...");
        const worker = Tesseract.createWorker({
            logger: (m) => console.log(`Tesseract: ${m.status}`),
        });

        try {
            await worker.load();
            await worker.loadLanguage("eng");
            await worker.initialize("eng");
            logMessage("📖 OCR engine ready");

            // Perform OCR on the image
            logMessage("🔍 Analyzing image text...");
            const { data: { text, words } } = await worker.recognize(img);
            console.log("OCR words sample:", words.slice(0, 3));
            logMessage(`📝 Extracted text: ${text.substring(0, 50)}...`);

            // Detect the start of options (A., B., C., D.)
            logMessage("🔎 Detecting question options...");
            const optionsStartY = detectOptionsStart(words);
            console.log("Options start at Y:", optionsStartY);
            if (optionsStartY === null) {
                logMessage("⚠️ Warning: No options detected in OCR results");
                throw new Error("Could not find question options");
            }

            // Crop the question section
            logMessage("✂️ Cropping question section...");
            performCropping(img, 0, optionsStartY);
            document.getElementById("croppedQuestionContainer").style.display = "block";

            // Format the extracted text using Groq API
            logMessage("🌐 Sending extracted text to Groq API...");
            await getFormattedQuestion(text);
            document.getElementById("questionFrame").style.display = "block";
        } finally {
            await worker.terminate();
            console.log("🛑 Tesseract worker terminated");
        }
    } catch (error) {
        console.error("❌ Processing error:", error);
        logMessage(`❌ Critical Error: ${error.message}`);
        alert(`Processing failed: ${error.message}`);
    }
}

function performCropping(img, startY, endY) {
    console.log("Cropping between Y:", startY, endY);
    try {
        const canvas = document.getElementById("canvas");
        if (!canvas) throw new Error("Canvas element missing");

        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const cropHeight = endY - startY;
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = canvas.width;
        croppedCanvas.height = cropHeight;

        const croppedCtx = croppedCanvas.getContext("2d");
        croppedCtx.drawImage(
            canvas,
            0,
            startY,
            canvas.width,
            cropHeight,
            0,
            0,
            canvas.width,
            cropHeight
        );

        const croppedImage = new Image();
        croppedImage.src = croppedCanvas.toDataURL("image/png");
        document.getElementById("croppedOutput").innerHTML = "";
        document.getElementById("croppedOutput").appendChild(croppedImage);
        console.log("✅ Cropping completed successfully");
    } catch (error) {
        console.error("❌ Cropping error:", error);
        throw error;
    }
}

function detectOptionsStart(words) {
    console.log("Detecting options from", words?.length, "words");
    if (!words?.length) return null;

    const optionPattern = /^[A-D]\.?$/i; // Flexible matching for A., B., etc.
    for (const word of words) {
        console.log("Checking word:", word.text);
        if (optionPattern.test(word.text.trim())) {
            console.log("✅ Found option marker:", word.text);
            return word.bbox.y0;
        }
    }
    return null;
}

async function getFormattedQuestion(text) {
    try {
        logMessage("🌐 Connecting to Groq API...");
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "mixtral-8x7b-32768",
                messages: [
                    {
                        role: "system",
                        content:
                            "Extract and format as: Question: [question]\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer: [letter]\nExplanation: [text]",
                    },
                    {
                        role: "user",
                        content: text,
                    },
                ],
                temperature: 0.7,
                max_tokens: 500,
            }),
        });

        const data = await response.json();
        console.log("Groq API response:", data);

        if (data.choices?.[0]?.message?.content) {
            const formatted = data.choices[0].message.content;
            document.getElementById("generatedQuestion").textContent = formatted;
            logMessage("✅ Successfully formatted question");
        } else {
            throw new Error("Invalid API response");
        }
    } catch (error) {
        console.error("❌ API Error:", error);
        logMessage(`❌ API Error: ${error.message}`);
        throw error;
    }
}

// Logging functions
function logMessage(message) {
    const timestamp = new Date().toISOString().slice(11, 19);
    const entry = `[${timestamp}] ${message}`;
    logs.push(entry);
    console.log(entry); // Log to browser console
    const logContent = document.getElementById("logContent");
    if (logContent) logContent.textContent = logs.join("\n");
}

function showLogs() {
    document.getElementById("logModal").style.display = "block";
}

function closeLogModal() {
    document.getElementById("logModal").style.display = "none";
}
