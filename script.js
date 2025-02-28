let croppedImages = [];
let currentIndex = 0;

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "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";

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

        positions.push(img.height);
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
        document.getElementById("mergeQuestionBtn").style.display = "block";
        
        console.log("Displaying cropped image", currentIndex + 1);
        currentIndex++;
    }
}

function makeQuestion() {
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) return alert("No image to process!");

    Tesseract.recognize(outputImage.src, 'eng').then(({ data }) => {
        let text = data.text.trim();
        console.log("OCR Text:", text);

        fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [{ role: "user", content: `Extract question, options, correct answer, and explanation from this text: ${text}` }]
            })
        })
        .then(response => response.json())
        .then(data => {
            let result = data.choices[0].message.content;
            console.log("API Response:", result);
            
            let parsedData = parseQuestionData(result);
            displayQuestion(parsedData);
        })
        .catch(error => console.error("Error:", error));
    });
}

function parseQuestionData(text) {
    let lines = text.split("\n").map(line => line.trim()).filter(line => line);
    let questionText = lines[0];
    let options = lines.slice(1, 5);
    let explanation = lines.find(line => line.startsWith("Explanation:")) || "No explanation provided.";
    
    let correctAnswer = options.find(option => explanation.includes(option)) || "Not found";
    
    return { questionText, options, correctAnswer, explanation };
}

function displayQuestion({ questionText, options, correctAnswer, explanation }) {
    document.getElementById("questionFrame").style.display = "block";
    document.getElementById("questionText").innerText = questionText;
    
    let optionsList = document.getElementById("optionsList");
    optionsList.innerHTML = "";
    options.forEach(option => {
        let li = document.createElement("li");
        li.innerText = option;
        optionsList.appendChild(li);
    });

    document.getElementById("correctAnswer").innerText = correctAnswer;
    document.getElementById("explanation").innerText = explanation;
}

function mergeAndMakeQuestion() {
    let outputImage = document.getElementById("outputImage");
    if (!outputImage.src) return alert("No cropped image available!");

    document.getElementById("finalCroppedImage").src = outputImage.src;
    makeQuestion();
}
