/**
 * Diagnostic script to check menu item inventory links
 * Run with: npx ts-node scripts/diagnose-stock-issue.ts
 */
import { PrismaClient } from '../main/prisma';
async function diagnose() {
    const prisma = new PrismaClient();
    try {
        console.log('🔍 Diagnosing Stock Management Issue\n');
        // Check menu_item_inventory links
        console.log('=== Menu Item Inventory Links ===');
        const links = await prisma.menuItemInventory.findMany({
            include: {
                menuItem: { select: { name: true } },
                inventory: { select: { itemName: true, currentStock: true, unit: true } },
            },
            take: 10,
        });
        if (links.length === 0) {
            console.log('⚠️  NO MENU ITEM INVENTORY LINKS FOUND!');
            console.log('\nThis is why stock quantities aren\'t changing!');
            console.log('\nSolution:');
            console.log('1. Go to Admin Panel → Menu Items');
            console.log('2. Edit each menu item');
            console.log('3. Link it to inventory items (ingredients)');
            console.log('4. Set the quantity needed per menu item');
            console.log('\nExample: Pizza → Cheese (200g), Dough (300g), Tomato Sauce (100ml)');
        }
        else {
            console.log(`✅ Found ${links.length} menu item inventory links:\n`);
            links.forEach((link) => {
                console.log(`  ${link.menuItem.name} → ${link.inventory.itemName}`);
                console.log(`    Quantity per item: ${link.quantity} ${link.inventory.unit}`);
                console.log(`    Available stock: ${link.inventory.currentStock} ${link.inventory.unit}\n`);
            });
        }
        // Check inventory items
        console.log('\n=== Inventory Items ===');
        const inventoryItems = await prisma.inventory.findMany({
            take: 5,
            select: { itemName: true, currentStock: true, unit: true, category: true },
        });
        console.log(`Total inventory items: ${inventoryItems.length}`);
        inventoryItems.forEach((item) => {
            console.log(`  ${item.itemName}: ${item.currentStock} ${item.unit} (${item.category})`);
        });
        // Check menu items
        console.log('\n=== Active Menu Items ===');
        const menuItems = await prisma.menuItem.findMany({
            where: { isActive: true },
            take: 5,
            select: { name: true, price: true },
        });
        console.log(`Total active menu items: ${menuItems.length}`);
        menuItems.forEach((item) => {
            console.log(`  ${item.name} - $${item.price}`);
        });
        // Check addon inventory links
        console.log('\n=== Addon Inventory Links ===');
        const addonLinks = await prisma.addonInventoryItem.findMany({
            include: {
                addon: { select: { name: true } },
                inventory: { select: { itemName: true, currentStock: true } },
            },
            take: 10,
        });
        if (addonLinks.length === 0) {
            console.log('⚠️  No addon inventory links found');
        }
        else {
            console.log(`✅ Found ${addonLinks.length} addon inventory links:\n`);
            addonLinks.forEach((link) => {
                console.log(`  Addon: ${link.addon.name} → ${link.inventory.itemName}`);
                console.log(`    Quantity per addon: ${link.quantity}`);
                console.log(`    Available stock: ${link.inventory.currentStock}\n`);
            });
        }
        console.log('\n' + '='.repeat(50));
        console.log('✅ Diagnostic Complete');
        console.log('='.repeat(50));
    }
    catch (error) {
        console.error('❌ Error during diagnosis:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
diagnose();
