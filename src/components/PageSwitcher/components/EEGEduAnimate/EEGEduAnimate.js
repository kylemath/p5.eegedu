import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Card,
  Button,
  TextField,
  DropZone,
  Stack,
  Caption,
  Select,
  ButtonGroup,
  Link,
} from "@shopify/polaris";
import { zipSamples, MuseClient } from "muse-js";
import { bandpassFilter, epoch, fft, powerByBand, sliceFFT } from "@neurosity/pipes";
import { catchError, multicast } from "rxjs/operators";
import { Subject } from "rxjs";
import Sketch from "react-p5";
import styled from "styled-components";
import { LiveProvider, LiveEditor, LiveError, LivePreview } from "react-live";
import { saveAs } from "file-saver";

import { mockMuseEEG } from "../../utils/mockMuseEEG";
import { chartStyles } from "../chartOptions";
import theme from "./p5Theme";

const animateSettings = {
  cutOffLow: .1,
  cutOffHigh: 128,
  nbChannels: 4,
  interval: 32,
  bins: 256,
  duration: 128,
  srate: 256,
};

export function Animate(connection) {

  // Populate Select file list from github repo .art

  function readRepoList(value) {
    function reqListener () {
      setRepoContents(this.responseText);
    }
    var oReq = new XMLHttpRequest();
    oReq.addEventListener("load", reqListener);
    oReq.open("GET", value);
    oReq.send();
  }

  const [repoContents, setRepoContents] = useState();

  const pathPrefix = 'https://raw.githubusercontent.com/kylemath/p5.eegedu.art/main/';
  const address = 'https://api.github.com/repos/kylemath/p5.eegedu.art/git/trees/main?recursive=1';
  let options = [];

  useEffect(()=>{
    readRepoList(address)
  }, []) // <-- empty dependency array

  if (repoContents) {
    const repoObj = JSON.parse(repoContents)

    for (let i = 0; i < repoObj.tree.length; i++) {
        if (repoObj.tree[i].path.charAt(repoObj.tree[i].path.length-1) === '5') 
        {
          options.push({
            label: repoObj.tree[i].path, 
            value: pathPrefix + repoObj.tree[i].path
          })
        }
    }

  }

  //Uploading file
  const [uploadFile, setUploadFile] = useState();
  const handleDropZoneDrop = useCallback(
    (_dropFiles, acceptedFiles, _rejectedFiles) => {
      setUploadFile(acceptedFiles[0]);
    },
    []
  );

  const fileUpload = !uploadFile && <DropZone.FileUpload />;
  const uploadFileDescription = uploadFile && (
    <Stack>
      <div>
        {uploadFile.name} <Caption>{uploadFile.size} bytes</Caption>
      </div>
    </Stack>
  );

  // Saving File
  const [fileName, setFileName] = useState("MySketch.p5");
  const handleFilenameChange = useCallback(
    (newValue) => setFileName(newValue),
    []
  );

  // Read file from web
  function readFile(value) {
    console.log('reading file')
    function reqListener () {
      setFileContents(this.responseText);
    }
    var oReq = new XMLHttpRequest();
    oReq.addEventListener("load", reqListener);
    oReq.open("GET", value);
    oReq.send();
  }

  const [selectedWebCode, setSelectedWebCode] = useState(pathPrefix + 'BasicFrequencyBands.p5');  
  const handleSelectWebCodeChange = useCallback((value) =>
    {
      setSelectedWebCode(value)
      readFile(value)
    },
    []
  );

 // Main file in use
  const [fileContents, setFileContents] = useState();

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
       DELTA = brain.current.bands.data.delta[0] * 10;
       THETA = brain.current.bands.data.theta[0]* 10;
       ALPHA = brain.current.bands.data.alpha[0]* 10;   
       BETA =  brain.current.bands.data.beta[0]* 10;
       GAMMA =  brain.current.bands.data.gamma[0]* 10;
       
       gap = (DELTA + THETA + ALPHA + BETA + GAMMA)/5;
       
       p5.textSize(DELTA);
       p5.fill(clickValue,DELTA*5,20);
       p5.text('Delta', MOUSEX+40, MOUSEY-(2*gap));
       p5.ellipse(MOUSEX,MOUSEY-(2*gap),DELTA);

       p5.textSize(THETA);
       p5.fill(20, clickValue, THETA*5);
       p5.text('Theta', MOUSEX+40, MOUSEY-(1*gap));
       p5.ellipse(MOUSEX,MOUSEY-(1*gap),THETA);

       p5.textSize(ALPHA);
       p5.fill(ALPHA*5, clickValue, clickValue);
       p5.text('Alpha', MOUSEX+40, MOUSEY);   
       p5.ellipse(MOUSEX,MOUSEY,ALPHA);

       p5.textSize(BETA);
       p5.fill(BETA*5, clickValue, BETA*5);
       p5.text('Beta', MOUSEX+40, MOUSEY+(1*gap));   
       p5.ellipse(MOUSEX,MOUSEY+(1*gap),BETA);

       p5.textSize(GAMMA);
       p5.fill(clickValue, GAMMA*5/2, GAMMA*5);
       p5.text('Gamma', MOUSEX+40, MOUSEY+(2*gap));   
       p5.ellipse(MOUSEX,MOUSEY+(2*gap),GAMMA);
          
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

  // Load in file for first time
  useEffect(()=>{
    // readFile(pathPrefix + 'BasicFrequencyBands.p5')
    setFileContents(testScript)
  }, []) // <-- empty dependency array

  const bandsProto = {delta:[0], theta:[0], alpha:[0], beta:[0], gamma:[0], textMsg: "No data."}
  const spectraProto = {psd:[0], freqs:[0], textMsg: "No data."}

  const brain = useRef({
    bands: bandsProto,
    spectra: spectraProto,
  });

  // Wrap this whole thing in useEffect to control when it updates
  // it only updates when dependencies are changed, which in this case is just [connection]
  useEffect(() => {

    let channelData$;
    let pipeBands$;
    let pipeSpectra$
    let multicastBands$;
    let multicastSpectra$;
    let museClient;   

    const connectMuse = async() => {
      console.log('dingdong')
      museClient = new MuseClient();
      await museClient.connect();
      await museClient.start();
      return;
    }

    const buildBrain = async() => {
      if (connection.status.connected) {
        if (connection.status.type === "mock") {
          channelData$ = mockMuseEEG(256);
        } else {
          await connectMuse();
          channelData$ = museClient.eegReadings;
        }


          pipeBands$ = zipSamples(channelData$).pipe(
            bandpassFilter({
              cutoffFrequencies: [
                animateSettings.cutOffLow,
                animateSettings.cutOffHigh,
              ],
              nbChannels: animateSettings.nbChannels,
            }),
            epoch({
              duration: animateSettings.duration,
              interval: animateSettings.interval,
              samplingRate: animateSettings.srate,
            }),
            fft({ bins: animateSettings.bins }),
            powerByBand(),
            catchError((err) => {
              console.log(err);
            })
          );          
          multicastBands$ = pipeBands$.pipe(multicast(() => new Subject()));
          multicastBands$.subscribe((data) => {
            brain.current.bands = {
              data: data,
              textMsg: "Data received",
            }; 
            console.log('brain output: ', brain.current)

          });

          multicastBands$.connect();

 
          pipeSpectra$ = zipSamples(channelData$).pipe(
            bandpassFilter({
              cutoffFrequencies: [
                animateSettings.cutOffLow,
                animateSettings.cutOffHigh,
              ],
              nbChannels: animateSettings.nbChannels,
            }),
            epoch({
              duration: animateSettings.duration,
              interval: animateSettings.interval,
              samplingRate: animateSettings.srate,
            }),
            fft({ bins: animateSettings.bins }),
            sliceFFT([1, 128]),
            catchError((err) => {
              console.log(err);
            })
          );

          multicastSpectra$ = pipeSpectra$.pipe(multicast(() => new Subject()));
          multicastSpectra$.subscribe((data) => {
            brain.current.spectra = {
              data: data,
              textMsg: "Data received",
            }; 
            console.log('brain output: ', brain.current)

          });

          multicastSpectra$.connect();      


      }
    }

    buildBrain();

  }, [connection])

  function renderEditor() {
    const scope = { styled, brain, React, Sketch };

    return (  
        <LiveProvider
          code={fileContents}
          scope={scope}
          noInline={true}
          theme={theme}
        >  
         <Select
            label="Select Example Code"
            options={options}
            onChange={handleSelectWebCodeChange}
            value={selectedWebCode}
          />      

          <br />

          <LiveEditor id="liveEditor" />
            {fileContents && <LiveError />}


          {fileContents && <LivePreview />} 
          <ButtonGroup>
            <Button
              onClick={() => {
                resetSelectedCode();
              }}
              primary
            >
              {'Reset Code'}
            </Button>     
            <Button
              onClick={() => {
                restartCurrentCode();
              }}
              primary
            >
              {'Restart Current Code'}
            </Button>  
          </ButtonGroup>  
          <Card.Section>
            <TextField
              label="Filename:"
              value={fileName}
              onChange={handleFilenameChange}
              autoComplete="off"
            />
            <br />
            <Button
              onClick={() => {
                saveFile();
              }}
              primary
            >
              {"Save code to text file"}
            </Button>
         
          </Card.Section>
             <p>
                {
                  'The examples above are all stored in a '
                }
                <Link url="https://github.com/kylemath/p5.eegedu.art/" external={true}> 
                   public repository 
                </Link>
                {[
                '. You can save your .p5 code and submit your artwork as code to the repository.',
                ]}
              </p>             
          <Card.Section>
            <DropZone allowMultiple={false} onDrop={handleDropZoneDrop}>
              {uploadFileDescription}
              {fileUpload}
            </DropZone>
            <br />
            <Button
              onClick={() => {
                loadFile();
              }}
              primary
              disabled={!uploadFile}
            >
              {"Load code from added file"}
            </Button>

          </Card.Section>
        </LiveProvider>

    );

    function saveFile() {
      const text = document.getElementById("liveEditor").firstChild.value;
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      saveAs(blob, fileName );
    }
    function loadFile() {
      uploadFile.text().then((content) => setFileContents(content));
    }

    function resetSelectedCode() {
      readFile(selectedWebCode)
    }
    function restartCurrentCode() {
      const text = document.getElementById("liveEditor").firstChild.value
      setFileContents(text.concat(' '));
    }  
  }

  return (
    <Card title="Animate your brain waves"> 
      <Card.Section>
        <p>
        {[
          'The live animation is controlled by the P5.js code below. The code is ',
          'editable. Play around with the numbers and see what happens. The',
          'brain.current variables are only available if there is a data source',
          'connected. EEG bands and locations are available by calling ' ,
          'brain.current.data.alpha[0], for example for the left ear electrode alpha.',
        ]}
        </p>
        <br />
        <p>
          {
            'The examples below are all stored in a '
          }
          <Link url="https://github.com/kylemath/p5.eegedu.art/" external={true}> 
             public repository 
          </Link>
          {[
          '. You can save your .p5 code with a button at the bottom of the page.',
          'You can then submit your artwork as code to the repository.',
          ]}
        </p>
      </Card.Section>
      <Card.Section>
        <div style={chartStyles.wrapperStyle.style}>{renderEditor()}</div>
      </Card.Section>
    </Card>
  );
}
