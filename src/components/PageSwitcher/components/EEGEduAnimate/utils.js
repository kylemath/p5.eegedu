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

export default protos
