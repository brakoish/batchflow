import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useDialogFocus } from '../app/components/useDialogFocus'
function Panel({close,nested=false}:{close:()=>void,nested?:boolean}) {
 const ref=useRef<HTMLDivElement>(null)
 const [child,setChild]=useState(false)
 useDialogFocus(ref,true,close)
 return <div style={{position:'fixed',inset:nested?'25%':'10%',background:'white',border:'2px solid black',padding:20,zIndex:nested?20:10}} ref={ref} role="dialog" aria-label={nested?'Nested fixture':'Outer fixture'} aria-modal="true"><button onClick={close}>Cancel {nested?'nested':'outer'}</button><input aria-label="Fixture name"/><button onClick={()=>setChild(true)}>Open nested</button>{child&&<Panel nested close={()=>setChild(false)}/>}</div>
}
function App(){const [open,setOpen]=useState(false);return <><button id="trigger" onClick={()=>setOpen(true)}>Open fixture</button><button id="background">Background action</button>{open&&<Panel close={()=>setOpen(false)}/>}</>}
createRoot(document.getElementById('root')!).render(<App/> )
