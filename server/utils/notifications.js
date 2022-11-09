const config = require('config')
const axios = require('axios')

exports.send = async (notification) => {
  await axios.post(`${config.privateNotifyUrl || config.notifyUrl}/api/v1/notifications`, notification, { params: { key: config.secretKeys.notifications } })
    .catch(err => console.error('Failure to push notification', notification, err.response || err))
}
