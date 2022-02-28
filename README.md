# P5.EEGEdu

P5.EEGEdu is an educational website to learn about coding live animations with electroencephalogram (EEG) data. It is a teaching tool that allows for students to quickly interact with their own brain waves. 

Visit [https://p5.eegedu.com/](https://p5.eegedu.com/]) for the live p5 sandbox website.

# Installation for Development 

If you are interested in developing p5.EEGEdu, here are some instructions to get you started.

Note: Currently p5.EEGEdu development requires a Mac OSX operating system. 

To start, you will need to install [Homebrew](https://brew.sh) and [yarn](https://yarnpkg.com/lang/en/docs/install/#mac-stable). These are easy one-line installations for Mac users: 

```sh
# Install homebrew
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

# Install yarn
# NOTE: this will also install Node.js if it is not already installed.
brew install yarn 
# Node.js must be version 10.x for Muse interaction
# Thus, if you are getting version issues, install n and switch versions
# sudo npm install -g n
# sudo n 10.16.0
```

Then, in terminal, clone the git repo and enter the folder:

```sh
git clone https://github.com/kylemath/p5.EEGEdu
cd p5.EEGEdu
```

You then need to install the required packages for EEGEdu

```sh
yarn install
```

## Local Development Environment
Then, you can run the *Development Environment* of p5.EEGEdu:

```sh
yarn start dev
```

If it is working correctly, the p5.EEGEdu application will open in a browser window at http://localhost:3000.

## Local Production Environment

To start the *Local Production Environment*, you can use the following commands: 

```sh
# blank slate
yarn cache clean
yarn run build
serve -s build
```

## Deployment

[p5.EEGEdu](https://p5.eegedu.com) is running on [Firebase](https://firebase.google.com/) and deployment happens automagically using GitHub post-commit hooks, or [Actions](https://github.com/kylemath/EEGEdu/actions), as they are commonly called. You can see how the application is build and deployed by [inspecting the workflow](https://github.com/kylemath/EEGEdu/blob/master/.github/workflows/workflow.yml).

# Contributing
The guide for contributors can be found [here](https://github.com/kylemath/EEGEdu/blob/master/CONTRIBUTING.md). It covers everything you need to know to start contributing to p5.EEGEdu.

# Development Roadmap 

# References

* ![Muse JS Library](https://github.com/urish/muse-js)
* ![Muse EEG Explorer Live Demo](https://github.com/NeuroJS/angular-muse)
* ![Muse EEG Frequency Domain Data - starting point](https://github.com/tanvach/muse-fft)
* ![Easy pipable operations on eeg data from muse-js](https://github.com/neurosity/eeg-pipes)
* ![React JS Web Development](https://reactjs.org/)
* ![Interactive Charts](https://www.chartjs.org/docs/latest/)
* ![Muse LSL](https://github.com/urish/muse-lsl)

# Credits

`p5.EEGEdu` - An Interactive Electrophysiology P5 Animation Coding Sandbox with the Interaxon Muse brought to you by Mathewson Sons

# License

[p5.EEGEdu is licensed under The MIT License (MIT)](https://github.com/kylemath/p5.EEGEdu/blob/master/LICENSE)
