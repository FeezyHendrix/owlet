import { render } from 'preact'
import '../ui/global.css'
import { Settings } from './Settings'

const root = document.getElementById('root')
if (root) render(<Settings />, root)
