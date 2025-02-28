async function cropAndGenerateQuestion() {
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) {
        alert("No image displayed to crop!");
        return;
    }

    console.log("Cropping image...");
    const img = new Image();
    img.src = outputImage.src;

    await new Promise(resolve => img.onload = resolve);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Perform cropping (detect options and crop the relevant section)
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

    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCanvas.width = canvas.width;
    croppedCanvas.height = optionsStartY;

    croppedCtx.drawImage(canvas, 0, 0, canvas.width, optionsStartY, 0, 0, canvas.width, optionsStartY);
    
    const croppedImage = new Image();
    croppedImage.src = croppedCanvas.toDataURL("image/png");
    document.getElementById("output").innerHTML = "";
    document.getElementById("output").appendChild(croppedImage);

    console.log("Extracting text from cropped image...");
    const textWorker = Tesseract.createWorker();
    await textWorker.load();
    await textWorker.loadLanguage("eng");
    await textWorker.initialize("eng");

    const { data: { text } } = await textWorker.recognize(croppedImage);
    await textWorker.terminate();

    if (!text.trim()) {
        alert("No text detected. Please use a clearer image.");
        return;
    }

    console.log("Sending extracted text to Groq API...");
    getFormattedQuestion(text);
}

async function getFormattedQuestion(text) {
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const API_KEY = "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";
    
    const requestData = {
        model: "mixtral-8x7b-32768",
        messages: [
            { role: "system", content: "Extract and format the given text into a structured question format: \n\nQuestion:\nOptions:\nA) ...\nB) ...\nC) ...\nD) ...\nCorrect Answer:\nExplanation:" },
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

        if (result.choices && result.choices.length > 0) {
            const formattedQuestion = result.choices[0].message.content;
            document.getElementById("generatedQuestion").innerText = formattedQuestion;
            document.getElementById("questionFrame").style.display = "block";
        } else {
            alert("Failed to generate the question.");
        }
    } catch (error) {
        console.error("Error fetching from Groq API:", error.message);
        alert(`An error occurred: ${error.message}`);
    }
}

function detectOptionsStart(words) {
    for (let i = 0; i < words.length; i++) {
        if (["A.", "B.", "C.", "D."].includes(words[i].text.trim())) {
            return words[i].bbox.y0;
        }
    }
    return null;
}
