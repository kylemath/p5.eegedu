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
  List,
  RangeSlider,
} from "@shopify/polaris";
import { zipSamples, MuseClient } from "muse-js";
import { bandpassFilter, epoch, fft, powerByBand } from "@neurosity/pipes";
import Sketch from "react-p5";
import styled from "styled-components";
import { LiveProvider, LiveEditor, LiveError, LivePreview } from "react-live";
import { saveAs } from "file-saver";

import { mockMuseEEG } from "../../utils/mockMuseEEG";
import { chartStyles } from "../chartOptions";
import theme from "./p5Theme";
import protos from "./utils";

const animateSettings = {
  name: 'EEG',
  cutOffLow: .1,
  cutOffHigh: 128,
  nbChannels: 4,
  interval: 32,
  bins: 256,
  duration: 128,
  srate: 256,
  sliceFFTLow: 1,
  sliceFFTHigh: 100,
};

const pathPrefix = 'https://raw.githubusercontent.com/kylemath/p5.eegedu.art/main/';
const address = 'https://api.github.com/repos/kylemath/p5.eegedu.art/git/trees/main?recursive=1';

export function Animate(connection) {

  // Output Prototypes
  // --------------
  const brain = useRef({
    epochs: protos.epochs,
    bands: protos.bands,
    spectra: protos.spectra,
  });

  // Main file in use
  // ------------------
  const [fileContents, setFileContents] = useState();
  const [Settings, setSettings] = useState(animateSettings); 


  // Populate Select file list from github repo .art
  //------------------------

  function readRepoList(value) {
    function reqListener () {
      setRepoContents(this.responseText);
    }
    var oReq = new XMLHttpRequest();
    oReq.addEventListener("load", reqListener);
    oReq.open("GET", value);
    oReq.send();

  }


  function renderSliders(setSettings, Settings) {
    function resetPipeSetup(value) {
      //somehow rerrun buildbrian here
      console.log('Reset the pipes here')
      console.log(Settings)
    }


    function handleDurationRangeSliderChange(value) {
      setSettings(prevState => ({...prevState, duration: value}));
      resetPipeSetup();
    }
    function handleIntervalRangeSliderChange(value) {
      setSettings(prevState => ({...prevState, interval: value}));
      resetPipeSetup();
    }
    function handleCutoffLowRangeSliderChange(value) {
      setSettings(prevState => ({...prevState, cutOffLow: value}));
      resetPipeSetup();
    }
    function handleCutoffHighRangeSliderChange(value) {
      setSettings(prevState => ({...prevState, cutOffHigh: value}));
      resetPipeSetup();
   }

    return (
      <Card title={Settings.name + ' Settings'} sectioned>
        <RangeSlider 
          disabled={connection.status.connected} 
          min={.01} step={.5} max={Settings.cutOffHigh - .5}
          label={'Filter Cutoff Frequency Low: ' + Settings.cutOffLow + ' Hz'} 
          value={Settings.cutOffLow} 
          onChange={handleCutoffLowRangeSliderChange} 
        />
        <RangeSlider 
          disabled={connection.status.connected} 
          min={Settings.cutOffLow + .5} step={.5} max={Settings.srate/2}
          label={'Filter Cutoff Frequency High: ' + Settings.cutOffHigh + ' Hz'} 
          value={Settings.cutOffHigh} 
          onChange={handleCutoffHighRangeSliderChange} 
        />          
        <RangeSlider 
          disabled={connection.status.connected} 
          min={1} step={1} max={4096}
          label={'Epoch duration (Sampling Points): ' + Settings.duration} 
          value={Settings.duration} 
          onChange={handleDurationRangeSliderChange} 
        />          
        <RangeSlider 
          disabled={connection.status.connected} 
          min={1} step={1} max={Settings.duration}
          label={'Sampling points between epochs onsets: ' + Settings.interval} 
          value={Settings.interval} 
          onChange={handleIntervalRangeSliderChange} 
        />
  
      </Card>
    )
  }


  let options = [];
  const [repoContents, setRepoContents] = useState();
  useEffect(()=>{
    console.log('Reading Repo List')
    readRepoList(address)
  }, []) // <-- empty dependency array

  if (repoContents) {
    console.log('Parsing repo list');
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

  // Read file from web
  // -------------------

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
      console.log('Reading Selected Web file')
      setSelectedWebCode(value)
      readFile(value)
    },
    []
  );

  // Uploading files
  //---------------------

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

  // Saving Files
  // ---------------------

  const [fileName, setFileName] = useState("MySketch.p5");
  const handleFilenameChange = useCallback(
    (newValue) => setFileName(newValue),
    []
  );

  // Load file once (not when connection updates like useEffect below)
  // -----------------------
  
  useEffect(()=>{
   console.log('Loading in Test File or first file');
    readFile(pathPrefix + 'BasicFrequencyBands.p5')

  }, []) // <-- empty dependency array


  // Wrap this whole thing in useEffect to control when it updates
  // it only updates when dependencies are changed, which in this case is just [connection]
  useEffect(() => {
 
    let channelData$;
    let pipeEpochs$;
    let pipeSpectra$
    let pipeBands$;

    let museClient;   

    const connectMuse = async() => {
      museClient = new MuseClient();
      await museClient.connect();
      await museClient.start();
      return;
    }

    const buildBrain = async() => {
      if (connection.status.connected) {
        if (connection.status.type === "mock") {
          console.log('Connecting to mock data');
          channelData$ = mockMuseEEG(256);
        } else {
          console.log('connecting to muse data');
          await connectMuse();
          channelData$ = museClient.eegReadings;
        }

          // ------
          // epochs
          //------
          pipeEpochs$ = zipSamples(channelData$).pipe(
            bandpassFilter({
              cutoffFrequencies: [
                Settings.cutOffLow,
                Settings.cutOffHigh,
              ],
              nbChannels: Settings.nbChannels,
            }),
            epoch({
              duration: Settings.duration,
              interval: Settings.interval,
              samplingRate: Settings.srate,
            })
          );
          pipeEpochs$.subscribe((dataEpoch) => {
            brain.current.epochs = {
              data: dataEpoch,
              dataReceived: true,
            };
           });
     

          // ------
          // spectra
          //------  

          pipeSpectra$ = zipSamples(channelData$).pipe(
            bandpassFilter({
              cutoffFrequencies: [
                Settings.cutOffLow,
                Settings.cutOffHigh,
              ],
              nbChannels: Settings.nbChannels,
            }),
            epoch({
              duration: Settings.duration,
              interval: Settings.interval,
              samplingRate: Settings.srate,
            }),
            fft({ bins: Settings.bins })
          );
          pipeSpectra$.subscribe((dataSpectra) => {
            brain.current.spectra = {
              data: dataSpectra,
              dataReceived: true,
            }; 
          });

          // ------
          // bands
          //------

          pipeBands$ = zipSamples(channelData$).pipe(
            bandpassFilter({
              cutoffFrequencies: [
                Settings.cutOffLow,
                Settings.cutOffHigh,
              ],
              nbChannels: Settings.nbChannels,
            }),
            epoch({
              duration: Settings.duration,
              interval: Settings.interval,
              samplingRate: Settings.srate,
            }),
            fft({ bins: Settings.bins }),
            powerByBand()
          );          
          pipeBands$.subscribe((dataBands) => {
            brain.current.bands = {
              data: dataBands,
              dataReceived: true,
            }; 
          });

      }
    }

    buildBrain();

  }, [connection, Settings])

  function renderEditor() {
    const scope = { styled, brain, React, Sketch };

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
          {connection.status.connected && fileContents && <LivePreview />} 
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
  }

  return (
    <Card title="Animate your brain waves"> 
      <Card.Section>
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
        <br />   
        <p>
        {[
          'The live animation is controlled by the P5.js code below. The code is ',
          'editable. Play around with the numbers and see what happens. The',
          'brain.current variables are only available if there is a data source',
          'connected. EEG bands and locations are available by calling: ' ,
        ]}
        </p>
        <br />
        <List type="bullet">
          <List.Item><i>brain.current.bands.data.alpha[0] </i>- Left Ear Alpha Power.</List.Item>
          <List.Item><i>brain.current.bands.data.theta[3]  </i>- Right Ear Theta Power.</List.Item>
          <List.Item><i>brain.current.spectra.data.psd[0]  </i>- Left Ear frequency Spectra.</List.Item>
          <List.Item><i>brain.current.spectra.data.freqs  </i>- corresponding frequencies.</List.Item>
          <List.Item><i>brain.current.epochs.data.data[2]  </i>- Right Forehead Epoched time series filtered data</List.Item>
          <List.Item><i>brain.current.epochs.data.info.samplingRate  </i>- data sampling rate.</List.Item>
        </List>
      </Card.Section>
      <Card.Section>
        <div style={chartStyles.wrapperStyle.style}>{renderSliders(setSettings, Settings)}</div>
      </Card.Section>
      <Card.Section>
        <div style={chartStyles.wrapperStyle.style}>{renderEditor()}</div>
      </Card.Section>
    </Card>
  );
}

