"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { IconWorldSearch, IconLoader2 } from "@tabler/icons-react"

type UrlInputProps = {
  onSubmit: (url: string) => void
  isLoading: boolean
  defaultValue?: string
}

export default function UrlInput({
  onSubmit,
  isLoading,
  defaultValue = "",
}: UrlInputProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    let url = value.trim()
    if (!url) return

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    try {
      new URL(url)
    } catch {
      setError("Please enter a valid URL")
      return
    }

    setValue(url)
    onSubmit(url)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-3">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <IconWorldSearch className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Paste a URL to audit... e.g. https://example.com"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError("")
            }}
            className="h-12 pl-11 text-base"
            autoFocus
          />
        </div>
        <Button type="submit" size="lg" disabled={isLoading || !value.trim()}>
          {isLoading ? (
            <>
              <IconLoader2 className="size-4 animate-spin" />
              Discovering...
            </>
          ) : (
            "Discover Pages"
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
