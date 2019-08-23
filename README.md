# misty-interact
This is a server-side app which lets [Misty](https://www.mistyrobotics.com/) interact with people by controlling her via her REST API.

This app contains various "feats" (or skills) which can be combined to give Misty more complex human-like behavior. The project contains several experiments in the `experiments` folder each of which can be run using:

```
yarn start <experiment>
```

where `<experiment>` is the name of the corresponding subfolder. Most experiments explore ways in which Misty can interact with humans by looking them in the eye, recognizing and resonding to speech, making emotive movements, etc.

Before running an experiment, make sure that you've run `yarn install` and have set up a `.env` file with the correct environment variables. `.env.example` contains a list of the variables which need to be set.

Some experiments require integration with third party services or additional software to be used with. For example, all speech-related experiments require integration with Google's Text-To-Speech and Speech-To-Text services. For this purpose, you need to create a project from the Google Cloud Console, enable TTS and STT for that project, generate a `gapi-credentials.json` file, and add the path to that file to the `.env` variables. Similar principles apply to the experiments which use Wit.ai or Pandorabots.com - you need to setup an account in the corresponding service, configure a chatbot, and provide the credentials as `.env` variables.

In some experiments the audio is being recorded by an external device. The [`MistyInterface`](https://github.com/asteasolutions/MistyInterface) iOS app can be used for this purpose.
