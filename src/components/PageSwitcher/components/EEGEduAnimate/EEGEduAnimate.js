import React, { useState, useCallback, useRef } from "react";
import {
  Card,
  Button,
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
  cutOffLow: 2,
  cutOffHigh: 20,
  nbChannels: 4,
  interval: 16,
  bins: 256,
  duration: 128,
  srate: 256,
};

const defaultEditorCode = `
class MySketch extends React.Component {
 setup(p5, whereToPlot) {
   p5.createCanvas(500, 500).parent(whereToPlot)
   clickValue = 0;
   p5.background(255,255,200);

 }

 draw(p5) {
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
   LEFTALPHA = brain.current.RightFrontAlpha;
   RIGHTALPHA = brain.current.LeftFrontAlpha;

   p5.fill(200, 120, clickValue);
   p5.ellipse(MOUSEX-100,MOUSEY,LEFTALPHA*2);
   p5.fill(20, 200, clickValue);
   p5.ellipse(MOUSEX+100,MOUSEY,RIGHTALPHA*2);
 }

 // other p5 functions can be created like this
 // but must be included below in the return call
 mouseClicked(p5) {
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
  const [fileContents, setFileContents] = useState(defaultEditorCode);

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
