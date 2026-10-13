'use client'
import { useEffect } from 'react'
export default function UiTranslation({ language }: { language: string }) {
  useEffect(() => {
    const previous = document.documentElement.lang
    document.documentElement.lang = language === 'zh-CN' ? 'zh-CN' : 'en'
    return () => { document.documentElement.lang = previous }
  }, [language])
  return null
}
