import {
  registerPlugin,
} from '@capacitor/core'

type SaveJsonOptions = {
  filename: string
  content: string
}

type SaveJsonResult = {
  saved: boolean
}

type SaveFilePlugin = {
  saveJson(
    options: SaveJsonOptions
  ): Promise<SaveJsonResult>
}

const SaveFile =
  registerPlugin<SaveFilePlugin>(
    'SaveFile'
  )

export default SaveFile
