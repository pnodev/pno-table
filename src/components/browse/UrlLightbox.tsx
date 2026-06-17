import { ExternalLink } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

type UrlLightboxProps = {
  url: string | null
  onOpenChange: (open: boolean) => void
}

type UrlLightboxPreviewProps = {
  url: string
}

function UrlLightboxPreview({ url }: UrlLightboxPreviewProps) {
  const [useIframe, setUseIframe] = useState(false)

  const openInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (useIframe) {
    return (
      <div className="url-lightbox-frame-wrap">
        <iframe
          src={url}
          title={`Preview of ${url}`}
          className="url-lightbox-frame"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    )
  }

  return (
    <div className="url-lightbox-frame-wrap">
      <button
        type="button"
        className="url-lightbox-image-button"
        title="Open image in new tab"
        onClick={openInNewTab}
      >
        <img
          src={url}
          alt=""
          className="url-lightbox-image"
          referrerPolicy="no-referrer"
          onError={() => setUseIframe(true)}
        />
      </button>
    </div>
  )
}

export function UrlLightbox({ url, onOpenChange }: UrlLightboxProps) {
  return (
    <Dialog open={url !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lightbox">
        <DialogHeader className="url-lightbox-header">
          <DialogTitle className="url-lightbox-title">{url}</DialogTitle>
          <DialogDescription className="sr-only">
            Preview of the URL stored in this table cell.
          </DialogDescription>
        </DialogHeader>

        {url ? <UrlLightboxPreview key={url} url={url} /> : null}

        <DialogFooter className="url-lightbox-footer">
          {url ? (
            <Button asChild variant="outline">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Open in new tab
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
