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

  // Load in file for first time
  useEffect(()=>{
    readFile(pathPrefix + 'BasicFrequencyBands.p5')
  }, []) // <-- empty dependency array

  const pipeline = 'spectra';

  const brain = useRef({
    data: {delta:[], theta:[], alpha:[], beta:[], gamma:[]},
    textMsg: "No data.",
  });

  // Wrap this whole thing in useEffect to control when it updates
  // it only updates when dependencies are changed, which in this case is just [connection]
  useEffect(() => {

    let channelData$;
    let pipeBands$;
    let pipeSpectra$
    let multicastBands$;
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

        if (pipeline === 'bands') {

          multicastBands$ = pipeBands$.pipe(multicast(() => new Subject()));

        } else if (pipeline === 'spectra') {

          multicastBands$ = pipeSpectra$.pipe(multicast(() => new Subject()));
      
        }

        multicastBands$.subscribe((data) => {
          console.log(data)
          brain.current = {
            data: data,
            textMsg: "Data received",
          }; 
        });

        multicastBands$.connect();
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
          'brain.current.RightFrontAlpha, for example.',
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
