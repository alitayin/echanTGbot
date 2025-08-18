const fs = require('fs');
const mods = require('../../../config/mods.json');

async function handleAdminCommands(msg, query, bot) {
    const username = msg.from.username;

    if (query.toLowerCase().startsWith('/addmod ')) {
        console.log('👥 处理添加管理员命令');
        const newMod = query.split(' ')[1].replace('@', ''); // Remove '@' from username
        if (!mods.reporters.includes(newMod)) {
            mods.reporters.push(newMod);
            fs.writeFileSync(require('path').join(__dirname, '../../../config/mods.json'), JSON.stringify(mods, null, 2));
            await bot.sendMessage(msg.chat.id, `Added ${newMod} as a moderator.`);
        } else {
            await bot.sendMessage(msg.chat.id, `${newMod} is already a moderator.`);
        }
        return true;
    } 
    else if (query.toLowerCase().startsWith('/removemod ')) {
        console.log('👥 处理移除管理员命令');
        const modToRemove = query.split(' ')[1];
        if (mods.reporters.includes(modToRemove)) {
            mods.reporters = mods.reporters.filter(mod => mod !== modToRemove);
            fs.writeFileSync(require('path').join(__dirname, '../../../config/mods.json'), JSON.stringify(mods, null, 2));
            await bot.sendMessage(msg.chat.id, `Removed ${modToRemove} from moderators.`);
        } else {
            await bot.sendMessage(msg.chat.id, `${modToRemove} is not a moderator.`);
        }
        return true;
    }
    
    return false;
}

module.exports = {
    handleAdminCommands
};
