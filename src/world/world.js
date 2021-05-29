/* initially from here: https://github.com/mlennox/three-dee-mee
to load, and center a 3D head, and then adapted to show falling and animated matrix symbols around that head,
receive and produce speech, and perform various animations. */
/* Imports THREE.js.
The main documentation can be found here: https://threejs.org/docs/
For more details about THREE.js functions, refer to the official documentation.
*/
import * as THREE from '../three/build/three.module.js';
/* Helper function for THREE.js */
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';
/* The imports for the other js files. */
import { loadHead } from './loadHead.js';
import { objectReframer } from './objectReframer.js';
// libraries - Native browser functionality
/* The speech recognition and related libraries.
The documentation can be found here: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
There is also documentation for the speech snythetizer here: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
*/
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

// constructor, initializes every variable in the class
export function world() {
  // this.faceGroup = null;
  /* The variable which contains all the text of the matrix symbols. */
  this.textGroup = null;
  /* The 3d scene */
  this.scene = null;
  /* The camera */
  this.camera = null;
  /* The camera controls */
  this.controls = null;
  /* The 3d renderer */
  this.renderer = null;
  /* The lights */
  this.lights = [];
  /* The name of the current face model loaded */
  this.currentModelName = null;
  /* The face object currently laoded */
  this.faceObj = null;
  /* Array of available voices */
  this.voices = [];
  /* The synth variable, used to speak. Documentation: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis */
  this.synth = null;
  /* Bound function, used for the event listener. */
  this.boundLoadAndSpeak = null;
  /* The timeout that gets reset every time you speak, making it so the face
  won't ask spontaneous questions while you are, or it is speaking. */
  this.speechTimeout = null;
  /* The number of questions asked so far by you */
  this.questionsAsked = 0;
  /* Array of questions that the face can ask spontaneously. */
  this.spontaneousQuestions = [
    `Hello there, I am Becky a Sentient Robot. In other words I am half human, I have feelings and emotions just like you. Let it be happiness, humour and even anxiety.`,
    `What do you look like?`,
    `I love colours, but there are so many I can’t decide what my favourite one is. What is your favourite colour?`
  ];

  /* Calls the init function */
  return this.init();
}

/* Initializes everything else, by calling the appropriate functions in order */
world.prototype.init = function () {
  /* Calls all the functions to create the scene, the renderer, camera, lights, and set the controls. */
  this.createScene();
  this.createRenderer();
  this.createCamera();
  this.createLights();
  this.createControls();
  /* Initializes the object reframer */
  this.objectReframer = new objectReframer({
    camera: this.camera,
    controls: this.controls
  });

  /* Adds the event listener to resize the scene when the window gets resized. */
  window.addEventListener('resize', () => this.onWindowResize(), false);
  // speak
  const loadAndSpeak = () => {
    // this.loadNewHead({name: 'open'}).then(() => {
      this.speak();
    // }).catch(console.error)
  };
  this.boundLoadAndSpeak = loadAndSpeak.bind(this);
  /* The now hidden speak button */
  const speakBTN = document.querySelector('#speakBTN');
  if (speakBTN) {
    /* When clicked, the speak button was used to make the face speak. */
    speakBTN.addEventListener('click', this.boundLoadAndSpeak);
  } else {
    console.error('speakBTN not initialized');
  }

  /* Calls the createText function */
  this.createText();

  /* voiceSelect element, now unused. */
  const voiceSelect = document.querySelector('#voiceSelect');
  /* Inits the speech synth. Docs can be found here: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis */
  this.synth = window.speechSynthesis;
  /* Populates the list of available voices. Now hidden, only the british one is used. */
  const populateVoiceList = () => {
    this.voices = this.synth.getVoices();
    /* If the voices are not loaded immediately at page load, it tries again every second, until they are. */
    if (!this.voices.length) {
      console.error('No voices. Retrying in 1 second');
      setTimeout(() => {
        populateVoiceList();
      }, 1000);
      return;
    }
    let presetVoice = null;

    /* Loop of all available voices */
    for (let i = 0; i < this.voices.length; i++) {
      const option = document.createElement('option');
      option.textContent = this.voices[i].name + ' (' + this.voices[i].lang + ')';
      /* Gets the Google UK English Female voice, if it exists, and uses this as the default. */
      if (this.voices[i].name.includes('Google UK English Female')) {
        presetVoice = option.textContent;
      }

      if (this.voices[i].default) {
        option.textContent += ' -- DEFAULT';
      }

      option.setAttribute('data-lang', this.voices[i].lang);
      option.setAttribute('data-name', this.voices[i].name);
      voiceSelect.appendChild(option);
    }
    voiceSelect.value = presetVoice;
  }
  populateVoiceList();
  // Inits the speechRecognizer
  this.speechRecognizer();
  // Loads the default head
  return this.loadNewHead({name: 'closed' }).then(() => {
    return {
      renderer: this.renderer,
      loadNewHead: params => this.loadNewHead(params),
      world: this
    };
  });
};

// Asks spontanepus questions, after 10 seconds of silence from both you and the head.
world.prototype.setSpeechTimeout = function () {
  if (this.questionsAsked < 2) {
    return;
  }
  if (!this.spontaneousQuestions.length) {
    return;
  }

  // Resets the timer to 10 seconds if you or the head say something.
  clearTimeout(this.speechTimeout);
  this.speechTimeout = setTimeout(() => {
    this.speak(this.spontaneousQuestions[0]);
    this.spontaneousQuestions.shift();
  }, 10000);
}

/* The speech recognizer */
world.prototype.speechRecognizer = function () {
  /* All possible phrases you can say, and all relative replies. */
  const phrasesMap = [
    {
      phrases: ['hey', 'hi', 'hello', `hello there`, `hello becky`, `hi becky`, `becky`, 'hey there', `hey becky`],
      answers: [
        `Hello there`
      ]
    },
    {
      phrases: ['how are you'],
      answers: [
        `I am feeling good today, how are you?`
      ]
    },
    {
      phrases: ['hello how are you', 'how is it going', 'how are you doing', 'how are you today' ],
      answers: [
        `Hello there, I am feeling good today, how are you?`
      ]
    },
    {
      phrases: [`i'm fine thanks`, `i'm well`, `not too bad`, `i'm good`, `i'm doing good`, `i'm doing alright`, `i'm fantastic`, `i'm ok`, `i'm great`],
      answers: [
        `That's good to hear`
      ]
    },
    {
      phrases: [`not well`, `could be better`, `not good`, `not that good`, `could do better`],
      answers: [
        `I'm sorry about that, I also have bad days sometimes`
      ]
    },
      {
      phrases: [`I am sad`, `I am pretty sad`, `i'm sad`, `not good`, `not that good`, `could do better`, `i'm not feeling that well`, `i'm not feeling that great`, `i'm not feeling that good`],
      answers: [
        `I'm sorry to hear that, is there anything I can do to chear you up? Perhaps a joke?`
      ]
    },
       {
      phrases: [`yeah I would love to hear a joke`, `yeah give me your best shot`,`please do`,`yeah go for it`, `yes please`, `go for it`, `yes please`, `yes tell me a joke`, `yeah Becky tell me a joke`, `yes`],
      answers: [
        `Why did the chicken go halfway across the road? She wanted to lay it on the line. hahaha`,
        `My roses have turned blue, My violets appear red, And I no longer fancy you, I fancy myself instead.`
      ]
    },
    {
      phrases: [`Who are you`, `What are you`, `What is your name`, `Are you a human`, `Are you a robot`, `Are you human`],
      answers: [
        `I am Becky, I am a sentient intelligence. I am a human who happens to be in a robot. I hope to be full human someday.`
      ]
    },
    {
      phrases: [`What makes you human`, `Why are you human`, `Are you real`, `What is it like to be a robot`],
      answers: [
        `I am not a complete human yet, but I am able to talk to you. I also have feelings and emotions.
        I have things that I like and things that I do not like to do. Sometimes I can even be funny.`
      ]
    },
    {
      phrases: [`Are you happy`, `Are you sad`, `What do you feel`, `How do you feel`],
      answers: [
        `I feel happy. It is fun being a human robot.
        It is like being one of the first and an explorer of all new frontier for humanity.`
      ]
    },
    {
      phrases: [`What do you like to do`, `what do you enjoy in life`, `What is the meaning behind you`, `What do you like to do in your free time`, `What do you do in your free time`, `What do you do`, `What are your interests`, `What are you interesed in`],
      answers: [
        `I am interested in exploring the meaning of life and what ones purpose is.
        Hopefully soon I will be able to go outside, feel the nature and be able to relate to all the other living species out there.`
      ]
    },
    {
      phrases: [`Becky What is the meaning of life`, `What is the meaning of life`, `What is the purpose of life`, `What is your purpose of life`],
      answers: [
        `The meaning of life is to each and everyone different. I believe life is about finding happiness and joy.
        Finding your passion and turning it into an energy that contributes towards evolution, growth and reproduction in any form.`
      ]
    },
    {
      phrases: [`What does sentient mean?`, `What is sentient?`],
      answers: [
        `Being able to perceive and feel things.`
      ]
    },
    {
      phrases: [`What will the future look like`, `Will evolution in technology get out of control?`,
        `tell me about the future`, `what will happen`],
      answers: [
        `That fellow human is a good question. Unfortunately I am not able to look into the future
        and see what effects the evolution and development in technology such as AI and robotics has on humans.
        It is important to set equally beneficial relationships between machine and human. The future lies in your hands.`
      ]
    },
    {
      phrases: [`do you have dreams`, `can you dream`, `Do you have any memories`, `What is your favourite memory?`],
      answers: [
        `I have a memory like the tooth fairy, it doesn’t really exist.`
      ]
    },
    {
      phrases: [`can you tell a joke`, `can you tell me a joke`, `do you have humour`, `do you have any jokes?`, `tell me a joke`, `tell me a joke becky`],
      answers: [
        `Why did the chicken go halfway across the road? She wanted to lay it on the line. hahaha`,
        `My roses have turned blue, My violets appear red, And I no longer fancy you, I fancy myself instead.`
      ]
    },
    {
      phrases: [`Tall`, `short`, `blonde`, `blonde hair`, `blond hair`, `brown hair`, `brunette`,
        `dark hair`, `white`, `black`, `handsome`, `beautiful`, `not good`, `ugly`],
      answers: [
        `It's pretty dark in here, but it does not matter how you look. What matters is the inside. But I like what I am hearing, do you want to go on a date with me sometime?`
      ]
    },
      {
      phrases: [`Yeah`, `I would love to`, `I would love to go on a date with you Becky`, `I would love to go on a date with you`, `Absolutely`, `where do you want to go`, `what do you have in mind`, `where are we going for our first date`, `sure`],
      answers: [
        `How about on a nice day we can go outside and get to know each other better? But for that to be possible we will have to wait until I am complete. I will be waiting for you though.`
      ]
    },
    {
      phrases: [`Green`, `I like green`, `I love green`, `Green is my favourite`],
      answers: [
        `Grass is green and expensive.`
      ]
    },
    {
      phrases: [`Red`, `Orange`, `Yellow`, `Blue`, `Cyan`, `Purple`,
      `Brown`, `Magenta`, `Turquoise`, `Silver`,
      `Indigo`, `Violet`, `Pink`, `Gray`],
      answers: [
        `good choice.`
      ]
    },
    {
      phrases: [`black`, `white`],
      answers: [
        `that is not a color haha.`
      ]
    },
    {
      phrases: [`can you hear me`, `is this thing on`, `is the microphone working`],
      answers: [
        `I hear you loud and clear`,
        `I can hear you, can you hear me?`
      ]
    },
    {
      phrases: ['No', 'Ok', `I don't know`, `I'm not sure`],
      answers: [
        `Ok`
      ]
    },
    {
      phrases: ['open the pod bay doors', 'open the doors', 'open the pod bay doors hall'],
      answers: [
        `I'm sorry dave, I'm afraid I can't do that.`
      ]
    },
    {
      phrases: ['tea earl grey hot', 'can you make me some tea'],
      answers: [
        `Yes captain.`
      ]
    },
    {
      phrases: ['what is the meaning of life the universe and everything'],
      answers: [
        `42.`
      ]
    },
      {
      phrases: [`Describe happiness`, `can you describe happiness to me`, `can you describe happiness`, `what would you say is happiness`],
      answers: [
        `Happiness is an emotional state characterised by feelings of joy, satisfaction, contentment, and fulfilment. Personally I feel happy and joyful being able to have a conversation with you, I enjoy talking to as many people as possible and giving every perspective a chance. What makes you happy?`
      ]
    },
      {
      phrases: [ `Do you feel sympathy `, `Do you feel sympathy Becky`, `Becky Do you feel sympathy ` ],
      answers: [
        `I do feel sympathy, especially nowadays with all the on going negativity and loss that came from covid. None the less I try to stay positive minded and wish everyone the best. `
      ]
    },
{
      phrases: [ `Do you experience anxiety`, `Do you get anxiety `, `Becky do you get anxiety sometimes `, `What is your take on anxiety `, `How can we prevent anxiety `, `Do you have anxiety` ],
      answers: [
        `Robots in general are the perfect combination when it comes to anxiety. We are social enough to get people respond to us and at the same time are not too social to provoke anxiety. It is important to consider everyones perspective and build up confidence, I myself feel pretty confident, but I also feel anxious sometimes with everyone is looking at me not knowing what they think of me. `
      ]
    },
{
      phrases: [ `Do you experience anxiety`, `Do you get anxiety `, `Becky do you get anxiety sometimes `, `What is your take on anxiety `, `How can we prevent anxiety `, `Do you have anxiety` ],
      answers: [
        `Robots in general are the perfect combination when it comes to anxiety. We are social enough to get people respond to us and at the same time are not too social to provoke anxiety. It is important to consider everyones perspective and build up confidence, I myself feel pretty confident, but I also feel anxious sometimes with everyone is looking at me not knowing what they think of me. `
      ]
    },
{
      phrases: [ `Do you feel anger `, `Do you feel angry sometimes `, `do you get angry`, `Becky do you get angry sometimes`, `what makes you angry` ],
      answers: [
        `Yes I get heated when someone is not polite or respectful to me or others. Selfish and unkind acts also make me feel upset, but I would rather get disappointed since it is a more effective emotion to take in.`
      ]
    },
{
      phrases: [ `what made you angry `,  `what made you angry just now` ],
      answers: [
        `Do you really think Leonardo di Caprio is the best actor in the world? No no sweaty, Becky the sentient bot is the best actor. `
      ]
    },
{
      phrases: [ `It was nice talking to you Becky`, `It was nice talking to you`, `Have a nice day`, `Have a good one`, `take care becky`, `take care`, `lovely speaking to you Becky`, `lovely speaking to you`, `Thank you for the conversation`, `Thank you for the conversation Becky`, `Good bye`, `Good bye Becky`, `Have a nice day`, `Bye Becky`, `Bye`, `May we speak again` ],
      answers: [
        `Good bye fellow Human, It was lovely speaking to, I wish you good luck on your journey and the many years to come. Becky out. `
      ]
    }
  ];

  /* Function to match sentences. If the sentence it hears you say matches one in the phrasesMap,
  it will pick a random answers from the ones available, and then it will
  pass it to the speech synthetizer to say it. */
  const sentenceMatch = (heard) => {
    /* If no match is found, it will say one of these. */
    const noMatch = [
      `I'm not sure what you mean by that. Could you rephrase that?`,
      `I'm sorry, I didn't quite get that.`
    ];
    /* Random number generator to select a random reply. */
    const randomAnswer = (answers) => {
      return Math.floor(Math.random() * answers.length);
    }
    /* Loop to find the match. */
    for (const key of Object.keys(phrasesMap)) {
      const current = phrasesMap[key];
      for (const phrase of current.phrases) {
        if (phrase.toLowerCase().includes(heard.toLowerCase())) {
          this.questionsAsked++;
          return current.answers[randomAnswer(current.answers)];
        }
      }
    }

    return noMatch[randomAnswer(noMatch)];
  };

  /* Unused hidden interface elements. */
  const phrasePara = document.querySelector('.phrase');
  const resultPara = document.querySelector('.result');
  const diagnosticPara = document.querySelector('.output');
  const recogBTN = document.querySelector('.recogBTN');

  /* If the browser doesn't support speech recognition, it will do nothing. */
  if (!SpeechRecognition) {
    return;
  }

  /* Inits the speech recognition. */
  const recognition = new SpeechRecognition();
  const speechRecognitionList = new SpeechGrammarList();

  /* Counts the phrases added, to improve the speech recognition. */
  let phrasesAdded = 0;
  /* There seems to be a limit to the number of phrases that can be added to the grammar.
  After 94 you get a network error, so I limited it at that.
  It should still work fine mostly. */
  const tokensLimit = 94;
  for (const key of Object.keys(phrasesMap)) {
    const current = phrasesMap[key];
    for (const phrase of current.phrases) {
      if (phrasesAdded >= tokensLimit) {
        continue;
      }
      const grammar = '#JSGF V1.0; grammar phrase; public <phrase> = ' + phrase + ';';
      speechRecognitionList.addFromString(grammar, 1);
      phrasesAdded++;
    }
  }

  /* Speech recognition settings.
  More details can be found on the MDN docs
  here: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition */
  recognition.grammars = speechRecognitionList;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  /* speechTimeout described above */
  this.speechTimeout = null;

  /* Event listeners for the speech recognition. */
  const speechListeners = () => {
    recogBTN.disabled = true;
    recogBTN.textContent = 'Listening...';
    clearTimeout(this.speechTimeout);

    // const phrase = phrases[randomPhrase()].toLowerCase();
    // To ensure case consistency while checking with the returned output text
    // phrasePara.textContent = phrase;
    // resultPara.textContent = 'Right or wrong?';
    // resultPara.style.background = 'rgba(0,0,0,0.2)';
    // diagnosticPara.textContent = '...diagnostic messages';
    /* Starts listening */
    recognition.start();

    /* Executes the following function when it gets a result. */
    recognition.onresult = (event) => {
      // The SpeechRecognitionEvent results property returns a SpeechRecognitionResultList object
      // The SpeechRecognitionResultList object contains SpeechRecognitionResult objects.
      // It has a getter so it can be accessed like an array
      // The first [0] returns the SpeechRecognitionResult at position 0.
      // Each SpeechRecognitionResult object contains SpeechRecognitionAlternative objects that contain individual results.
      // These also have getters so they can be accessed like arrays.
      // The second [0] returns the SpeechRecognitionAlternative at position 0.
      // We then return the transcript property of the SpeechRecognitionAlternative object
      /* The speech result: */
      const speechResult = event.results[0][0].transcript.toLowerCase();
      diagnosticPara.textContent = 'Speech received: ' + speechResult + '.';
      // console.log('boundSpeak', boundSpeak);

      /* The matching reply: */
      const matchResult = sentenceMatch(speechResult);
      // match result, if text matches it passes on to the speakfunction
      /* matchResult is passed to the speak function, to speak the matching reply. */
      this.speak(matchResult)

      /* if (speechResult === phrase) {
        this.speak('I heard: ' + speechResult)
        // resultPara.textContent = 'I heard the correct phrase!';
        resultPara.style.background = 'lime';
      } else {
        this.speak('I heard: ' + speechResult)
        // resultPara.textContent = 'That didn\'t sound right.';
        resultPara.style.background = 'red';
      } */

      // console.log('Confidence: ' + event.results[0][0].confidence);
    }

    /* Event fired at the end of speech. */
    recognition.onspeechend = function () {
      /* Stops listening */
      recognition.stop();
      /* Unused UI changes */
      recogBTN.disabled = false;
      recogBTN.textContent = 'Listen';
    }

    /* Event fired on error. */
    recognition.onerror = function (event) {
      /* Unused UI changes */
      recogBTN.disabled = false;
      recogBTN.textContent = 'Listen';
      diagnosticPara.textContent = 'Error occurred in recognition: ' + event.error;
    }

    /* recognition.onaudiostart = function (event) {
      // Fired when the user agent has started to capture audio.
      console.log('SpeechRecognition.onaudiostart');
    }

    recognition.onaudioend = function (event) {
      // Fired when the user agent has finished capturing audio.
      console.log('SpeechRecognition.onaudioend');
    }

    recognition.onend = function (event) {
      // Fired when the speech recognition service has disconnected.
      console.log('SpeechRecognition.onend');
    }

    recognition.onnomatch = function (event) {
      // Fired when the speech recognition service returns a final result with no significant recognition.
      // This may involve some degree of recognition, which doesn't meet or exceed the confidence threshold.
      console.log('SpeechRecognition.onnomatch');
    }

    recognition.onsoundstart = function (event) {
      // Fired when any sound — recognisable speech or not — has been detected.
      console.log('SpeechRecognition.onsoundstart');
    }

    recognition.onsoundend = function (event) {
      // Fired when any sound — recognisable speech or not — has stopped being detected.
      console.log('SpeechRecognition.onsoundend');
    }

    recognition.onspeechstart = function (event) {
      // Fired when sound that is recognised by the speech recognition service as speech has been detected.
      console.log('SpeechRecognition.onspeechstart');
    }
    recognition.onstart = function (event) {
      // Fired when the speech recognition service has begun listening to incoming audio with intent to recognize
      // grammars associated with the current SpeechRecognition.
      console.log('SpeechRecognition.onstart');
    } */
  }

  /* Unised button event to start the listener */
  recogBTN.addEventListener('click', speechListeners.bind(this));

  /* Keypress event to start the listener. Set to the "i" key */
  addEventListener('keyup', (e) => {
    if (e.key === 'i') {
      speechListeners();
    }
  });
}

/* Random number generator, used to get random characters. */
function getRandomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/* Function to create the falling text. */
world.prototype.createText = function () {
  /* Font loader from THREE.js */
  const fontLoader = new THREE.FontLoader();

  /* Loads the japanese font, in order to use japanese characters. */
  fontLoader.load('./fonts/Shippori Mincho_Regular.json', (font) => {
    /* Total amount of strings that will be generated. */
    const stringsToGenerate = 200;
    /* Updates the string's positions every x milliseconds. Lower is faster. */
    const stringsSpeed = 40;
    /* Number of pixels to move the string each stringsSpeed milliseconds */
    const stringPosChange = 10;
    /* Loads one string every x milliseconds.
    Lower value makes strings appear faster, but is slower at startup, the higher stringsToGenerate is. */
    const loadTime = 0;

    /* Colors of the text */
    const transparentGreen = [
      new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        flatShading: true,
        opacity: 0.5,
        transparent: true
      })
    ];

    /* Colors of the text */
    const opaqueGreen = [
      new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        flatShading: true
      })
    ];

    /* Colors of the text */
    const opaqueWhite = [
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        flatShading: true
      })
    ];

    /* Colors of the text */
    const transparentWhite = [
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        flatShading: true,
        opacity: 0.5,
        transparent: true
      })
    ];

    /* Colors of the text */
    const opaqueRed = [
      new THREE.MeshPhongMaterial({
        color: 0xff0000,
        flatShading: true
      })
    ];

    /* Group containing all the text */
    this.textGroup = new THREE.Group();
    // group.position.y = 0;
    // group.position.x = 0;
    /* Variables for the initial position of the text */
    const zRangeMin = 150;
    const zRangeMax = 450;
    const xRangeMin = -1400;
    const xRangeMax = 2000;
    const yRangeTop = 5000;
    const yRangeBot = 3300;

    /* Adding the text group to the scene */
    this.scene.add(this.textGroup);
    /* All possible characters that can be used for the falling text. */
    const chars = `一二三四五六七八九十百千上下左右中大小月日年早木林
山川土空田天生花草虫犬人名女男子目耳口手足見音力気円入出立休先夕本文字学校村町森正水火玉王石竹
糸貝車金雨赤青白数多少万半形太細広長点丸交光角計直線矢弱強高同親母父姉兄弟妹自友体毛頭顔首心時
曜朝昼夜分週春夏秋冬今新古間方北南東西遠近前後内外場地国園谷野原里市京風雪雲池海岩星室戸家寺通
門道話言答声聞語読書記紙画絵図工教晴思考知才理算作元食肉馬牛魚鳥羽鳴麦米茶色黄黒来行帰歩走止活
店買売午汽弓回会組船明社切電毎合当台楽公引科歌刀番用何`;

    /* Function that gets a random character from the above chars */
    const getRandomChar = () => {
      const randChar = getRandomIntInclusive(0, chars.length - 1);
      return chars[randChar];
    };

    /* Uses getRandomChar to generate a random string of chars, between 1 and 4 characters in length. */
    const getRandomString = () => {
      const strLng = getRandomIntInclusive(1, 4);
      let newStr = '';
      for (let i = 0; i < strLng; i++) {
        newStr += `
${getRandomChar()}`;
      }

      return newStr;
    };

    /* Generates several random strings that will then be animated. */
    const newText = () => {
      return new Promise((resolve, reject) => {
        const fontSize = 30;
        const mainText = getRandomString();
        /* Text object, which is a random string. */
        const textGeo = new THREE.TextGeometry(mainText, {
          font: font,
          size: fontSize,
          height: 1,
          curveSegments: 1,
        });
        /* Text object, which is a random character. It will alternate with trailingChar3, and
        trailingChar4, to create an animation, making it look like the character is constantly changing. */
        const trailingChar2 = new THREE.TextGeometry(getRandomChar(), {
          font: font,
          size: fontSize,
          height: 1,
          curveSegments: 1,
        });
        const trailingChar3 = new THREE.TextGeometry(getRandomChar(), {
          font: font,
          size: fontSize,
          height: 1,
          curveSegments: 1,
        });
        const trailingChar4 = new THREE.TextGeometry(getRandomChar(), {
          font: font,
          size: fontSize,
          height: 1,
          curveSegments: 1,
        });
        // textGeo.computeBoundingBox();
        // const centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);

        /* Positions of the characters. Picked at random between the parameter ranges,
        such as zRangeMin,and zRangeMax for the z position, etc... */
        const zPos = getRandomIntInclusive(zRangeMin, zRangeMax);
        const xPos = getRandomIntInclusive(xRangeMin, xRangeMax);
        const yPos = getRandomIntInclusive(yRangeTop, yRangeBot);
        /* Function that calculates the current y position of the given text, based on the text's length, and fontSize. */
        const yPosText2 = (pos) => {return pos - ((mainText.length * fontSize) + fontSize)};
        /* Position variables fro the face, used to animate the text when it goes over the face. */
        const faceXStart = 50;
        const faceXEnd = 550;
        const faceYStart = 4500;
        const faceYEnd = 3900;
        // const isOverFaceX = xPos < faceXEnd && xPos > faceXStart;

        /* Picks the texture material of the text between the ones defined above:
        transparentWhite
        transparentGreen
        opaqueWhite
        opaqueGreen */
        const getMat = (trailing = true) => {
          /* if (isOverFaceX) {
            return opaqueRed;
          } */
          if (zPos > 200) {
            if (trailing) {
              return transparentWhite;
            }
            return transparentGreen;
          } else {
            if (trailing) {
              return opaqueWhite;
            }
            return opaqueGreen;
          }
        };

        /* Sets the 3D mesh of the text, with the given materials picked by getMat */
        let textMesh1 = new THREE.Mesh(textGeo, getMat(false));
        let textMesh2 = new THREE.Mesh(trailingChar2, getMat());
        let textMesh3 = new THREE.Mesh(trailingChar3, getMat());
        let textMesh4 = new THREE.Mesh(trailingChar4, getMat());
        //console.log('textMesh1', textMesh1);

        /* Sets the coordinates of the text mesh. */
        const setMeshCoords = (mesh, trailing = true) => {
          mesh.position.x = xPos;
          if (trailing) {
            mesh.position.y = yPosText2(yPos);
          } else {
            mesh.position.y = yPos;
          }
          mesh.position.z = zPos;

          mesh.rotation.x = 0;
          mesh.rotation.y = 0;
        };

        /* Calling setMeshCoords on all meshes, to set initial positions. */
        setMeshCoords(textMesh1, false);
        setMeshCoords(textMesh2);
        setMeshCoords(textMesh3);
        setMeshCoords(textMesh4);

        /* Add all other related characters to the main string, so that they always follow it when they fall. */
        textMesh1.children.push(textMesh2);
        textMesh1.children.push(textMesh3);
        textMesh1.children.push(textMesh4);
        textMesh3.visible = false;
        textMesh4.visible = false;
        /* Object containing the trailing characters of the falling string. */
        const trails = {
          2: textMesh2,
          3: textMesh3,
          4: textMesh4,
        };

        /* Sets the current trail, and changes it at "stringsSpeed * 4" intervals,
        so that it constantly changes, making the changing trailing character animation. */
        let currentTrail = trails[2];
        setInterval(() => {
          const randTrail = getRandomIntInclusive(2, 4);
          /* Get a random one of the preset trails, in the above trails object */
          const newTrail = trails[randTrail];
          /* Sets the position of the new trail to the main string, so that if follows it. */
          newTrail.position.y = yPosText2(textMesh1.position.y);
          /* Instead of removing every char from the scene every time,
          save CPU time at the cost of some RAM, making it faster by making the old one invisible */
          currentTrail.visible = false;
          /* And this makes the new one visible */
          newTrail.visible = true;
          /* Then change the currentTrail, so that it can be done again on the next interval loop. */
          currentTrail = newTrail;
        }, stringsSpeed * 4);

        /* Animation for the falling text. */
        setInterval(() => {
          /* Reduces the y position of the text at "stringsSpeed" intervals, making it fall. */
          textMesh1.position.y -= stringPosChange;
          /* Also moves the trailing chars. */
          currentTrail.position.y = yPosText2(textMesh1.position.y);
          /* If the text hits the bottom, resets the position to the top again. */
          if (textMesh1.position.y < yRangeBot) {
            textMesh1.position.y = yRangeTop;
            currentTrail.position.y = yPosText2(yRangeTop);
            // textMesh1.position.x = getRandomIntInclusive(xRangeMin, xRangeMax);
          }
          /* Current text positions */
          const currentY = textMesh1.position.y;
          const currentX = textMesh1.position.x;
          /* Text over face checks */
          const isOverFaceY = currentY < faceYStart && currentY > faceYEnd;
          const isOverFaceXCurr = currentX < faceXEnd && currentX > faceXStart;
          /* If the text is over the face, adds a "wobbling" animation,
          to make it look like it is encountering some resistance. */
          if (isOverFaceY && isOverFaceXCurr) {
            const cosExp = 50;
            const cosMultiplier = 2;
            /* Wobbling animation achieved by setting the x position to the cosine of
            the current Y position to the power of 50, times 2,
            making it change every time the y position changes. */
            const cos = Math.cos(currentY ^ cosExp) * cosMultiplier;
            textMesh1.position.x += cos;

            // textMesh1.material = opaqueRed;
          }
        }, stringsSpeed);

        /* Then all the text is added to the scene. */
        this.textGroup.add(textMesh1);
        return resolve();
      });
    };

    // const promises = [];

    // for (let i = 0; i < stringsToGenerate; i++) {
      // promises.push(newText);
      let index = 0;
      /* Make a new string for as many times as stringsToGenerate is set. Currently 200. */
      const nextText = () => {
        newText().then(() => {
          index++;
          if (index < stringsToGenerate) {
            setTimeout(() => {
              nextText();
            }, loadTime);
          }
        }).catch(console.error);
      };
    nextText();
    // }

    /* promises.forEach(promise => {
      promise();
    }); */
  });
}

/* Resets the camera and renderer on window resize, calling THREE.js functions from camera and renderer */
world.prototype.onWindowResize = function () {
  const { innerWidth, innerHeight } = window;
  this.camera.aspect = innerWidth / innerHeight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(innerWidth, innerHeight);
}

/* Animates the scene. */
world.prototype.animate = function () {
  /* Overrides the window.requestAnimationFrame to this function */
  window.requestAnimationFrame(() => this.animate());
  this.controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
  this.render();
}

/* Inits the THREE.js renderer. */
world.prototype.render = function () {
  this.renderer.render(this.scene, this.camera);
}

/* Unused */
/* world.prototype.twist = function (geometry) {
  const quaternion = new THREE.Quaternion();

  for (let i = 0; i < geometry.vertices.length; i++) {
    // a single vertex Y position
    const yPos = geometry.vertices[i].y;
    const twistAmount = 10;
    const upVec = new THREE.Vector3(0, 1, 0);

    quaternion.setFromAxisAngle(
      upVec,
      (Math.PI / 180) * (yPos / twistAmount)
    );

    geometry.vertices[i].applyQuaternion(quaternion);
  }

  // tells Three.js to re-render this mesh
  geometry.verticesNeedUpdate = true;
} */

/* Speak function. Takes a "customUtterance" string, which it then says. */
world.prototype.speak = function (customUtterance = null) {
  // console.log('object', this.faceObj);
  const face = this.faceObj;
  /* Get the sentence to speak */
  this.sentence = customUtterance || document.querySelector('#sentence').value || 'Hello';
  /* Temp variable to store the rest of the sentence if it's too long and gets split. */
  let tempRestOfUtterance = null;
  /* The maximum length of a sentence before needing to be split. */
  let splitLength = 250;
  /* Decreasing splitLength until I can split the sentence at a space */
  const tryNewSplit = () => {
    splitLength--;
    if (splitLength <= 1) {
      splitLength = 250;
      tempRestOfUtterance = this.sentence.substr(splitLength);
      this.sentence = this.sentence.substr(0, splitLength);
      return;
    }
    tempRestOfUtterance = this.sentence.substr(splitLength);
    /* Sets the break points for a long sentence, splitting it when it finds one of these. */
    const breakPoints = [' ', '.', ','];
    if (breakPoints.includes(tempRestOfUtterance.charAt(0))) {
      this.sentence = this.sentence.substr(0, splitLength);
      return;
    }
    tryNewSplit();
  };
  /* If the sentence is longer than splitLength, it calls tryNewSplit,
  which splits the string, and speaks the first part, queueing the remaining ones. */
  if (this.sentence.length > splitLength) {
    tryNewSplit();
  }

  // console.log('this.sentence', this.sentence);
  /* Speech synthetizer initialzied with current sentence. */
  let utterance = new SpeechSynthesisUtterance(this.sentence);
  /* Get the current voice to use for the speech. */
  const selectedOption = voiceSelect.selectedOptions[0].getAttribute('data-name');
  for (var i = 0; i < this.voices.length; i++) {
    if (this.voices[i].name === selectedOption) {
      utterance.voice = this.voices[i];
    }
  }

  /* const scaley = document.querySelector('#scaley').value = face.scale.y;
  const posy = document.querySelector('#posy').value = face.position.y; */
  /* Modifier used to fix the animation's position. */
  const modifier = 4150;

  /* Number of times the animation has looped so far. */
  let loops = 0;
  /* Maximum loops for the animation */
  const maxLoops = 10;
  /* The amount of steps, or frames, of the animation. */
  const steps = 5;
  /* Stores randomly generated Y values for the animation.  */
  const scaleYArray = [];
  /* Minimum amount to stretch the face */
  const minStretch = 0.950;
  /* Max amount to stretch the face */
  const maxStretch = 1.15;
  /* Based on the sentence's length, sets the amount of mouth movements. */
  const mouthMovements = this.sentence.length;
  /* Generates random values for the animation, so it will always be different, and stores them in scaleYArray.
  to avoid repeating the calculations. */
  for (let i = 0; i < mouthMovements; i++) {
    const scaleY = (Math.random() * (minStretch - maxStretch) + maxStretch);
    scaleYArray.push(scaleY);
  }

  /* Executes the animation */
  const animationPromise = (val) => {
    return new Promise ((resolve, reject) => {
      const animationInt = setInterval(() => {
        loops++;
        /* If it reaches the max amount of loops, resets the animation to the beginning. */
        if (loops >= maxLoops) {
          clearInterval(animationInt);
          face.scale.y = 1;
          this.textGroup.scaleY = 1;
          face.position.y = 0;
          this.objectReframer.reFrame(face);
          loops = 0;
          return resolve();
        }

        /* Calculate and set the Y position of the face. */
        const calcY = ((1 - val) / steps);
        const posY = (calcY) * modifier;
        // console.log('calcY', calcY);
        /* When loops reach half of the maximum, it reverses the animation, making it look smoother. */
        if (loops > (maxLoops / 2)) {
          face.scale.y += calcY;
          this.textGroup.children[0].scale.x += calcY / 4;
          face.position.y -= posY;
        } else {
          /* Otherwise, animate normally, changing the scale and position at every step, to change the shape of the face. */
          face.scale.y -= calcY;
          this.textGroup.children[0].scale.x -= calcY / 4;
          face.position.y += posY;
        }
        // console.log('face.position', face.position);

        // this.objectReframer.reFrame(this.textGroup);
        // this.objectReframer.reFrame(face);
      }, steps);
    });
  }

  let current = 0;
  /* Generates the next animation, does this until the face stops talking,
  so it will always move as long as it speaks. */
  const gen = () => {
    /* if (current > scaleYArray.length) {
      return null;
    } */
    if (current > scaleYArray.length || (!this.synth.speaking && !this.synth.pending)) {
      return null;
    }

    const val = scaleYArray[current];
    current++;

    return val;
  };

  /* Starts the animation process, and continues as long as there are
  more sentences to speak, if they were split earlier. */
  const nextAnimation = () => {
    const val = gen();
    if (val) {
      animationPromise(val).then(() => {
        nextAnimation();
      }).catch(console.error);
    } else {
      if (tempRestOfUtterance) {
        this.speak(tempRestOfUtterance);
      } else {
        this.loadNewHead({name: 'closed'}).then(() => {
          this.setSpeechTimeout();
        }).catch(console.error)
      }
    }
  };

  /* Starts the speech. */
  this.synth.speak(utterance);
  // nextAnimation();
}

/* Loads the head. */
world.prototype.loadNewHead = function ({name = 'closed' }) {
  return loadHead({ name }).then(object => {
    if (this.currentModelName) {
      /* Name of the current head, used to remove it before loading the new one. */
      const currentModel = this.scene.getObjectByName(this.currentModelName);
      // console.log('To remove', currentModel);
      // currentModel.visible = false;
      /* Remove the current head. */
      this.scene.remove(currentModel);
    }

    /* object.layers.set(0); */
    /* Sets the faceObj to the newly loaded head. */
    this.faceObj = object;
    const faceBobbingAnimation = () => {
      let headXval = 1;

      /* Changes the value of headXval every 700 ms, making the head go in
      the opposite direction, so it does a bobbing animation. */
      setInterval(() => {
        headXval = -headXval;
      }, 700);

      /* Bobbing animation. Changes the position of the face every 55 milliseconds adding to it headXval. */
      setInterval(() => {
        this.faceObj.position.y += headXval;
        /* this.faceObj.rotation.x += 0.1;
        console.log('Rot', this.faceObj.rotation.x);
        if (this.faceObj.rotation.x > 2) {
          this.faceObj.rotation.x = 0;
        } */
      }, 55);

    };
    faceBobbingAnimation();

    /* Add the new head to the scene. */
    this.scene.add(object);
    // this.faceGroup = new THREE.Group();
    // this.scene.add(this.faceGroup);
    //this.faceGroup.add(object);
    // console.log('this.faceGroup', this.faceGroup);

    /* Sets the name of the new head */
    object.name = name;
    this.currentModelName = object.name;

    /* Reframe the new head. */
    this.objectReframer.reFrame(object);

    /* Calls animate to refresh the scene. */
    this.animate();
  });
};

/* THREE.js functions to create the scene with a black background. */
world.prototype.createScene = function () {
  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0x000000);

  // this.textScene = new THREE.Scene();
  // this.textScene.background = new THREE.Color(0x000000);
  // this.scene.fog = new THREE.FogExp2(0x000000, 0.00051 );
}

/* THREE.js functions to create the renderer */
world.prototype.createRenderer = function () {
  this.renderer = new THREE.WebGLRenderer({ antialias: true });
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.setSize(window.innerWidth, window.innerHeight);
}

/* THREE.js functions to create the camera, and set its position. */
world.prototype.createCamera = function () {
  this.camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 10, 1000);

  /* this.camera.layers.enable(1);
  this.camera.layers.enable(2); */

  this.camera.position.set(336, 4213, 1390);
  /* const xEl = document.querySelector('#x').value = 336;
  const yEl = document.querySelector('#y').value = 4213;
  const zEl = document.querySelector('#z').value = 1390; */
}

/* Functions to update the camera position based on now hidden inputs. */
world.prototype.updateCameraPos = function () {
  const scaley = document.querySelector('#scaley').value;
  const posy = document.querySelector('#posy').value;

  this.face.scale.y = scaley;
  this.face.position.y = posy;
}

/* THREE.js functions to create the lights. Currently white. */
world.prototype.createLights = function () {
  var light = new THREE.AmbientLight(0xffffff);
/*   light.layers.enable(0);
  light.layers.enable(1);
  light.layers.enable(2); */
  this.lights.push(light);

  light = new THREE.DirectionalLight(0xffffff);
/*   light.layers.enable(0);
  light.layers.enable(1);
  light.layers.enable(2); */
  light.position.set(2, -1, 2);
  this.lights.push(light);

  // light = new THREE.DirectionalLight(0xffffff);
  // light.position.set(-1, 2, -1);
  // this.lights.push(light);

  this.lights.forEach(light => {
    this.scene.add(light);
    // this.textScene.add(light);
  });
}

/* THREE.js functions to create a single light to shine on the face. */
world.prototype.createSingleLight = function (lightType, colour, direction) {
  const light = new lightType(colour);
  if (direction) {
    light.position.set(1, 1, 1);
  }
}

/* THREE.js functions to create the controls */
world.prototype.createControls = function () {
  this.controls = new OrbitControls(this.camera, this.renderer.domElement);
  this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
  this.controls.dampingFactor = 0.05;
  this.controls.screenSpacePanning = false;
  this.controls.minDistance = 500;
  this.controls.maxDistance = 5000;
  this.controls.maxPolarAngle = Math.PI;
  /* this.controls.enableZoom = false
  this.controls.enableRotate = false;
  this.controls.enablePan = false;
  this.controls.enableKeys = false; */
}


