"use client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Filter, Check } from "lucide-react";
const MenuCategoryFilter = ({ categories, selectedCategory, onCategoryChange, }) => {
    return (<DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <Filter className="w-4 h-4"/>
          <span>{selectedCategory || "All Categories"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onCategoryChange("")} className="flex items-center justify-between">
          <span>All Categories</span>
          {!selectedCategory && <Check className="w-4 h-4"/>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {categories.map((category) => (<DropdownMenuItem key={category} onClick={() => onCategoryChange(category)} className="flex items-center justify-between">
            <span>{category}</span>
            {selectedCategory === category && <Check className="w-4 h-4"/>}
          </DropdownMenuItem>))}
      </DropdownMenuContent>
    </DropdownMenu>);
};
export default MenuCategoryFilter;
