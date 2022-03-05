import qs from 'qs'
import slug from 'slug'

interface Category {
  text: string,
  key: string,
}

const modal = async (metadata:any) => {
  // @ts-ignore
  const categories:Category[] = JSON.parse(await Categories.get('list') || '[]')
  
  categories.push({
    key: 'custom',
    text: 'Custom value',
  })
  
  return {
    "title": {
      "type": "plain_text",
      "text": "Classify message"
    },
    "submit": {
      "type": "plain_text",
      "text": "Submit"
    },
    "blocks": [
      {
        "type": "section",
        "block_id": "category",
        "text": {
          "type": "mrkdwn",
          "text": "Pick a category"
        },
        "accessory": {
          "type": "static_select",
          "options": categories.map((category:Category) => ({
            "text": {
              "type": "plain_text",
              "text": category.text.substring(0, 75),
              "emoji": true
            },
            "value": category.key
          })),
          "action_id": "static_select-action"
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "New category",
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Can't find the category you need? Create a new one here."
        }
      },
      {
        "type": "input",
        "optional": true,
        "block_id": "customCategoryName",
        "element": {
          "type": "plain_text_input",
          "action_id": "name"
        },
        "label": {
          "type": "plain_text",
          "text": "Name",
          "emoji": true
        }
      }
    ],
    "type": "modal",
    "private_metadata": JSON.stringify(metadata)
  }
}

export async function handleRequest(request: Request): Promise<Response> {
  // @ts-ignore
  const body:string = await request.text()
  const params:any = qs.parse(body)
  console.log(JSON.stringify(params, undefined, 2))
  const payload = JSON.parse(params.payload)

  if (payload.type === 'message_action') {
    await showView(payload)
  } else if (payload.type === 'view_submission') {
    await submitClassification(payload)
  }

  return new Response()
}

async function showView(payload:any) {
  const init = {
    body: JSON.stringify({
      trigger_id: payload.trigger_id,
      view: await modal({
        message: payload.message,
        channel: payload.channel,
      }),
    }),
    method: "POST",
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      // @ts-ignore
      Authorization: `Bearer ${SLACK_TOKEN}`
    },
  }
  const response = await fetch('https://slack.com/api/views.open', init)
  console.log(await response.text())
}

async function submitClassification(payload:any) {
  let categoryId:string
  const selectCategoryId = payload.view.state.values.category['static_select-action'].selected_option?.value
  const customCategoryName = payload.view.state.values.customCategoryName.name.value
  const message = JSON.parse(payload.view.private_metadata)
  const user = payload.user

  // @ts-ignore
  const categories = JSON.parse(await Categories.get('list') || '[]')

  if (customCategoryName) {
    categoryId = slug(customCategoryName)
    categories.push({
      text: customCategoryName,
      key: categoryId,
    })
    // @ts-ignore
    await Categories.put('list', JSON.stringify(categories))
  } else {
    categoryId = selectCategoryId
  }
  
  // @ts-ignore
  const store = JSON.parse(await Categories.get('store') || '{}')
  if (store[categoryId] && Array.isArray(store[categoryId])) {
    store[categoryId].push({
      category: categories.find((c:Category) => c.key === categoryId),
      user,
      message,
    })
  } else {
    store[categoryId] = [{
      category: categories.find((c: Category) => c.key === categoryId),
      user,
      message,
    }]
  }
  // @ts-ignore
  await Categories.put('store', JSON.stringify(store))
  console.log('Data inserted')
}