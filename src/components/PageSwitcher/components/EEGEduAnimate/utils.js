const epochsProto = {
  data: {
    data: {
      0: Array(128).fill(0),
      1: Array(128).fill(0),
      2: Array(128).fill(0), 
      3: Array(128).fill(0),
      4: Array(128).fill(0),
    },
    info: {
        samplingRate: 256,
        startTime: 0,
    },
  }, 
  dataReceived: false,
};

const bandsProto = {
  data: {
    alpha: [0, 0, 0, 0, 0],
    beta: [0, 0, 0, 0, 0],
    delta: [0, 0, 0, 0, 0],
    gamma: [0, 0, 0, 0, 0],
    theta: [0, 0, 0, 0, 0],          
  },
  dataReceived: false,
};

const spectraProto = {
  data: {
    psd: {
      0: Array(128).fill(0),
      1: Array(128).fill(0),
      2: Array(128).fill(0), 
      3: Array(128).fill(0),
      4: Array(128).fill(0),
    },
    freqs: Array(128).fill(0),
    info: {
        samplingRate: 256,
        startTime: 0,
    },          
  },
  dataReceived: false,
};

const protos = {
  epochs: epochsProto, 
  bands: bandsProto, 
  spectra: spectraProto
};


const testScript = `
  class MySketch extends React.Component {
   setup(p5, whereToPlot) {
     p5.createCanvas(500, 500).parent(whereToPlot)
     clickValue = 0;
   }

   draw(p5) {
     p5.background(clickValue,255,200);

     // You can set some useful variables
     // to use more often like this:
     // Notice how everything starts with p5.
     HEIGHT = p5.height
     WIDTH = p5.width;
     MOUSEX = p5.mouseX;
     MOUSEY = p5.mouseY;

     // Availalable EEG Variables:
     // Electrodes 0, 1, 2, 3
     // Delta, Theta, Alpha, Beta, Gamma
     // e.g.:
     DELTA = 0;
     THETA = 0;
     ALPHA = 0;
     BETA =  0;
     GAMMA =  0;       
     if (brain.current.bands.data) {
       DELTA = brain.current.bands.data.delta[0] * 10;
       THETA = brain.current.bands.data.theta[0]* 10;
       ALPHA = brain.current.bands.data.alpha[0]* 10;   
       BETA =  brain.current.bands.data.beta[0]* 10;
       GAMMA =  brain.current.bands.data.gamma[0]* 10;
     }
     
   }

   // other p5 functions can be created like this
   // but must be included below in the return call
   mouseClicked(p5) {
     p5.background(200,255,210)
     if (clickValue === 0) {
       clickValue = 255;
       } else {
       clickValue = 0;
       }
   }

   render() {
     return (
        <Sketch
          setup={this.setup}
          draw={this.draw}
          mouseClicked={this.mouseClicked}
        />
     )
   }
  }

  render (
   <MySketch />
  )
`
export {protos, testScript}
