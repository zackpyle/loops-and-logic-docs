import React, { useEffect, useRef } from 'react'
import {
  startPlaygroundWeb
} from '@wp-playground/client'
import {
  defaultBlueprint,
} from './blueprints'
import type { StyleHTMLAttributes } from 'react'
import type { PlaygroundClient } from '@wp-playground/client'

type PlaygroundProps = {
  title?: string
  template?: string
  style?: string
  script?: string
  content?: {
    [postType: string]: PostDefinition[]
  }
  route?: string
  lazy?: boolean
  iframeStyle?: StyleHTMLAttributes<any>
  // Persistence not working - remote.html returns a nested iframe?
  storage?: 'opfs-host' | 'opfs-browser' | 'temporary'
  // https://wordpress.github.io/wordpress-playground/blueprints-api/steps
  // blueprint?: Blueprint
}

type PostDefinition = {
  post_title: string
  [field: string]: any
}

const PLAYGROUND_SERVER_URL =
  'https://playground.wordpress.net'
  // 'https://play.tangible.one'
  // 'http://localhost:3333'

export default function Playground(props: PlaygroundProps = {}) {

  const [isRunning, setIsRunning] = React.useState(props.lazy === false)

  const {
    iframeStyle = {},
    buttonText = 'Run'
  } = props

  const ref = useRef()

  useEffect(function () {

    if (!isRunning) return

    const iframe = ref.current
    if (!iframe) return

    start({
      ...props,
      iframe
    }).catch(console.error)

    return () => {
      // Clean up
    }

  }, [isRunning])

  if (!isRunning) {
    const start = () => setIsRunning(true)
    return <p>
      <button className="button button--primary" onClick={start}>
        {buttonText}
      </button>
    </p>
  }

  return <p>
    <iframe
      ref={ref}
      style={{
        width: '100%',
        height: '500px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        ...iframeStyle
      }}
    />
  </p>
}

async function start(props: PlaygroundProps & { iframe: HTMLIFrameElement }) {

  const {
    iframe,

    title = 'Example Template',
    template,
    style = '',
    script = '',
    // TODO: Other template fields like location, assets, controls

    // Create content
    content = {},

    storage = 'temporary',

    route = '/wp-admin/',

  } = props

  const playground: PlaygroundClient = await startPlaygroundWeb({
    // playground = startPlaygroundWeb({
    iframe,
    remoteUrl: `${
      PLAYGROUND_SERVER_URL
      }/remote.html?storage=${storage}`,
    blueprint: {
      ...defaultBlueprint,
      landingPage: route
    }
  })

  if (!playground) return
  if (content) {
    const { errors } = await playground.run({
      code: `<?php
      include 'wordpress/wp-load.php';
      wp_set_current_user(1);

      $content = json_decode(${
        // Object -> JSON -> Quoted JSON string
        JSON.stringify(JSON.stringify(content))
      }, JSON_OBJECT_AS_ARRAY);

      foreach ($content as $post_type => $posts) {
        foreach ($posts as $post) {
          wp_insert_post(array_merge([
            "post_author" => 1,
            "post_type" => $post_type,
            "post_title" => 'Post Title',
            "post_content" => '',
            "post_status" => "publish",
            "meta_input" => [
            ]
          ], $post));
        }
      }
      `
    })

    if (errors) console.error('Error creating content', errors)
  }
  if (template) {

    // Create template and show it on frontend

    const { text: templateId, errors } = await playground.run({
      code: `<?php
      include 'wordpress/wp-load.php';
      wp_set_current_user(1);
      
      $template_id = wp_insert_post([
        "post_author" => 1,
        "post_type" => "tangible_template",
        "post_title" => ${JSON.stringify(title)},
        "post_content" => ${JSON.stringify(template)},
        "post_status" => "publish",
        "meta_input" => [
          'style' => ${JSON.stringify(style)},
          'script' => ${JSON.stringify(script)},
        ]
      ]);

      echo $template_id;
      exit;
      `
    })

    if (errors) console.error('Error creating template', errors)

    if (templateId) {
      /**
       * Would have been nice to resize iframe height to fit its content but
       * it's complicated to achieve due to cross-site origin.
       */
      iframe.src = await playground.pathToInternalUrl(
        `/?template_id=${templateId}`
      )
    }
  }
}
