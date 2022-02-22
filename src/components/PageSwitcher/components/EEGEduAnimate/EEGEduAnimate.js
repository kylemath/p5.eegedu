import React, { useState, useCallback, useRef } from "react";
import {
  Card,
  Button,
  ButtonGroup,
  TextField,
  DropZone,
  Stack,
  Caption,
} from "@shopify/polaris";
import { zipSamples, MuseClient } from "muse-js";
import { bandpassFilter, epoch, fft, powerByBand } from "@neurosity/pipes";
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

const defaultEditorCode = `class MySketch extends React.Component {
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
   // Left, Right
   // Front, Back
   // Delta, Theta, Alpha, Beta, Gamma
   // e.g.:
   DELTA = brain.current.LeftBackDelta;
   THETA = brain.current.LeftBackTheta;
   ALPHA = brain.current.LeftBackAlpha;   
   BETA =  brain.current.LeftBackBeta;
   GAMMA =  brain.current.LeftBackGamma;
   
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

`;

export function Animate(connection) {
  const [uploadFile, setUploadFile] = useState();
  const [fileName, setFileName] = useState("MySketch.p5");
  let [fileContents, setFileContents] = useState(defaultEditorCode);

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

  const handleFilenameChange = useCallback(
    (newValue) => setFileName(newValue),
    []
  );

  const brain = useRef({
    LeftBackDelta: 0,
    LeftBackTheta: 0,
    LeftBackAlpha: 0,
    LeftBackBeta: 0,
    LeftBackGamma: 0,
    LeftFrontDelta: 0,
    LeftFrontTheta: 0,
    LeftFrontAlpha: 0,
    LeftFrontBeta: 0,
    LeftFrontGamma: 0,
    RightFrontDelta: 0,
    RightFrontTheta: 0,
    RightFrontAlpha: 0,
    RightFrontBeta: 0,
    RightFrontGamma: 0,
    RightBackDelta: 0,
    RightBackTheta: 0,
    RightBackAlpha: 0,
    RightBackBeta: 0,
    RightBackGamma: 0,
    textMsg: "No data.",
  });

  let channelData$;
  let pipeBands$;
  let multicastBands$;
  let museClient;

  async function connectMuse() {
    museClient = new MuseClient();
    await museClient.connect();
    await museClient.start();

    return;
  }

  async function buildBrain() {
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
        brain.current = {
          LeftBackDelta: 10 * data.delta[0],
          LeftBackTheta: 10 * data.theta[0],
          LeftBackAlpha: 10 * data.alpha[0],
          LeftBackBeta: 10 * data.beta[0],
          LeftBackGamma: 10 * data.gamma[0],
          LeftFrontDelta: 10 * data.delta[1],
          LeftFrontTheta: 10 * data.theta[1],
          LeftFrontAlpha: 10 * data.alpha[1],
          LeftFrontBeta: 10 * data.beta[1],
          LeftFrontGamma: 10 * data.gamma[1],
          RightFrontDelta: 10 * data.delta[2],
          RightFrontTheta: 10 * data.theta[2],
          RightFrontAlpha: 10 * data.alpha[2],
          RightFrontBeta: 10 * data.beta[2],
          RightFrontGamma: 10 * data.gamma[2],
          RightBackDelta: 10 * data.delta[3],
          RightBackTheta: 10 * data.theta[3],
          RightBackAlpha: 10 * data.alpha[3],
          RightBackBeta: 10 * data.beta[3],
          RightBackGamma: 10 * data.gamma[3],
          textMsg: "Data received",
        };
      });

      multicastBands$.connect();
    }
  }

  buildBrain();

  function renderEditor() {
    const scope = { styled, brain, React, Sketch };

    return (
      <LiveProvider
        code={fileContents}
        scope={scope}
        noInline={true}
        theme={theme}
      >
        <LivePreview />
        <br />
        <ButtonGroup>
          <Button
            onClick={() => {
              runCurrentCode();
            }}
            primary
          >
            {'Run Current Code'}
          </Button>        
          <Button
            onClick={() => {
              resetLoadedCode();
            }}
            primary
          >
            {'Reset to Loaded'}
          </Button>
          <Button
            onClick={() => {
              resetDefaultCode();
            }}
            primary
          >
            {'Reset to Default'}
          </Button>    
        </ButtonGroup>
        <br />    
        <LiveEditor id="liveEditor" />
        <Card.Section>
          <LiveError />
        </Card.Section>
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
            {"Load code from text file"}
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
    function runCurrentCode() {
      //something here, can't find the current code in the editor
      //setFileContents(LiveProvider.code)
    }
    function resetLoadedCode() {
      setFileContents(fileContents.concat(' '))
    }
    function resetDefaultCode() {
      setFileContents(defaultEditorCode.concat(' '))
    }
  }

  return (
    <Card title="Animate your brain waves">
      <Card.Section>
        <p>
          The live animation is controlled by the P5.js code below. The code is
          editable. Play around with the numbers and see what happens. The
          brain.current variables are only available if there is a data source
          connected. EEG bands and locations are available by calling
          brain.current.RightFrontAlpha
        </p>
      </Card.Section>
      <Card.Section>
        <div style={chartStyles.wrapperStyle.style}>{renderEditor()}</div>
      </Card.Section>
    </Card>
  );
}
