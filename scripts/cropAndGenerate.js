const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "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";

let logs = [];

function logMessage(message) {
    logs.push(message);
    console.log(message);
    updateLogDisplay();
}

function updateLogDisplay() {
    document.getElementById("logContent").innerText = logs.join("\n");
}

document.addEventListener("DOMContentLoaded", function () {
    const outputImage = document.getElementById("outputImage");
    const questionFrame = document.getElementById("questionFrame");
    const generatedQuestion = document.getElementById("generatedQuestion");

    document.getElementById("generateQuestionBtn").addEventListener("click", async function () {
        if (!outputImage.src) {
            alert("Please preview an image before cropping.");
            return;
        }

        logMessage("Starting OCR on the previewed image...");
        const extractedText = await extractTextFromPreviewedImage();

        if (!extractedText.trim()) {
            alert("No text detected in the image.");
            return;
        }

        const croppedImageData = await cropCurrentImage();

        if (!croppedImageData) {
            alert("Failed to crop the image.");
            return;
        }

        logMessage("Sending extracted text to Groq API...");
        const formattedQuestion = await generateQuestionFromText(extractedText);

        if (!formattedQuestion) {
            alert("Failed to generate question.");
            return;
        }

        displayFormattedQuestion(croppedImageData, formattedQuestion);
    });

    async function extractTextFromPreviewedImage() {
        if (!outputImage.src) {
            alert("No image displayed for OCR!");
            logMessage("Error: No image detected.");
            return "";
        }

        logMessage("Initializing Tesseract.js for OCR...");
        const worker = Tesseract.createWorker();
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");

        logMessage("Extracting text...");
        const { data: { text } } = await worker.recognize(outputImage);
        await worker.terminate();

        logMessage(`OCR Extracted Text:\n${text}`);
        return text;
    }

    function cropCurrentImage() {
        return new Promise((resolve) => {
            if (!outputImage.src) {
                alert("No image displayed to crop!");
                resolve(null);
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
                    resolve(null);
                    return;
                }

                resolve(performCropping(0, optionsStartY));
            };
        });
    }

    function performCropping(startY, endY) {
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");
        const cropHeight = endY - startY;

        if (cropHeight <= 0) {
            alert("Invalid cropping area.");
            return null;
        }

        const croppedCanvas = document.createElement("canvas");
        const croppedCtx = croppedCanvas.getContext("2d");
        croppedCanvas.width = canvas.width;
        croppedCanvas.height = cropHeight;

        croppedCtx.drawImage(canvas, 0, startY, canvas.width, cropHeight, 0, 0, canvas.width, cropHeight);

        return croppedCanvas.toDataURL("image/png");
    }

    function detectOptionsStart(words) {
        for (let i = 0; i < words.length; i++) {
            if (["A.", "B.", "C.", "D."].includes(words[i].text.trim())) {
                return words[i].bbox.y0;
            }
        }
        return null;
    }

    async function generateQuestionFromText(text) {
        logMessage("Calling Groq API for question generation...");

        const requestData = {
            model: "mixtral-8x7b-32768",
            messages: [
                {
                    role: "system",
                    content: "Extract and format the given text into a structured question format:\n\nQuestion:\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:"
                },
                { role: "user", content: text }
            ],
            max_tokens: 300
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            });

            logMessage("Groq API request sent. Waiting for response...");

            const result = await response.json();

            if (result.choices && result.choices.length > 0) {
                const formattedQuestion = result.choices[0].message.content;
                logMessage(`Generated Question:\n${formattedQuestion}`);
                return formattedQuestion;
            } else {
                logMessage("Error: Failed to generate question.");
                return null;
            }
        } catch (error) {
            console.error("Error fetching from Groq API:", error.message);
            logMessage(`API Error: ${error.message}`);
            return null;
        }
    }

    function displayFormattedQuestion(imageSrc, questionData) {
        questionFrame.style.display = "block";

        let formattedOutput = `
            <img src="${imageSrc}" style="max-width: 100%; border: 1px solid black; margin-bottom: 10px;">
            <p><strong>Generated Question:</strong></p>
            <pre>${questionData}</pre>
        `;

        generatedQuestion.innerHTML = formattedOutput;
    }

    function showLogs() {
        document.getElementById("logModal").style.display = "block";
    }

    function closeLogModal() {
        document.getElementById("logModal").style.display = "none";
    }
});
