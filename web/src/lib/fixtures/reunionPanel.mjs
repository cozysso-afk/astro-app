import {after} from 'node:test'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {timing} from '../readingExperience.fixtures.mjs'

const server=await createServer({root:fileURLToPath(new URL('../../../',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
const {RelationshipInterpretationPanel}=await server.ssrLoadModule('/src/RelationshipInterpretationPanel.tsx')
after(()=>server.close())

export const hierarchy={
  version:'fixture',as_of_date:timing.period.start,validation:{status:'PASS',checks:[]},
  stages:{contact_recontact:{activation:42,candidate_count:0}},top_periods:[],current_windows:[],past_windows:[],limitations:[],
}
export function renderReunion(props={}) {
  return renderToStaticMarkup(createElement(RelationshipInterpretationPanel,{
    analysisMode:'reunion',aspects:[],partnerExact:true,timeSensitivePoints:new Set(),formatAspect:()=>'',
    ai:null,aiLoading:false,aiError:'',onAi:()=>{throw Error('unexpected provider request')},
    hierarchy,timing,observation:{state:'recontacted',initiator:'',events:[]},...props,
  }))
}
