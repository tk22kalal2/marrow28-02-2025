document.getElementById("generateQuestionBtn").addEventListener("click", async function() {
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to process!");
        return;
    }

    console.log("Processing image for question extraction...");

    const img = new Image();
    img.src = outputImage.src;
    await img.decode();

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

    const croppedImageSrc = cropImage(0, optionsStartY);
    console.log("Cropped image ready.");

    console.log("Extracting text from full image...");
    const extractedText = await extractText(outputImage);
    if (!extractedText.trim()) {
        alert("No text detected. Please use a clearer image.");
        return;
    }

    console.log("Generating MCQ using Groq API...");
    const formattedQuestion = await generateQuestion(extractedText);
    if (!formattedQuestion) {
        alert("Failed to generate the question.");
        return;
    }

    displayGeneratedQuestion(croppedImageSrc, formattedQuestion);
});

function detectOptionsStart(words) {
    for (let i = 0; i < words.length; i++) {
        if (["A.", "B.", "C.", "D."].includes(words[i].text.trim())) {
            return words[i].bbox.y0;
        }
    }
    return null;
}

function cropImage(startY, endY) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const cropHeight = endY - startY;
    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCanvas.width = canvas.width;
    croppedCanvas.height = cropHeight;
    croppedCtx.drawImage(canvas, 0, startY, canvas.width, cropHeight, 0, 0, canvas.width, cropHeight);
    return croppedCanvas.toDataURL("image/png");
}

async function extractText(imageElement) {
    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { data: { text } } = await worker.recognize(imageElement);
    await worker.terminate();
    return text;
}

async function generateQuestion(text) {
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const API_KEY = "gsk_yy8xbTlJISG7MB5rtNWGdyb3FYMoamQEG41U6CbrGvthgU0N61";

    const requestData = {
        model: "mixtral-8x7b-32768",
        messages: [
            { role: "system", content: "Extract and format the given text into an MCQ format: \n\nQuestion:\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:" },
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

        const result = await response.json();
        return result.choices?.[0]?.message?.content || "";
    } catch (error) {
        console.error("Error fetching from Groq API:", error.message);
        return "";
    }
}

function displayGeneratedQuestion(imageSrc, questionText) {
    const questionFrame = document.getElementById("questionFrame");
    const generatedQuestion = document.getElementById("generatedQuestion");
    questionFrame.innerHTML = `<img src="${imageSrc}" style="max-width:100%;"><p>${questionText}</p>`;
    questionFrame.style.display = "block";
}
