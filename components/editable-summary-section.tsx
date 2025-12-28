"use client";

import { useState } from "react";
import { Edit2, Save, X, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SummaryText } from "@/components/summary-text";
import { HighlightableText } from "@/components/highlightable-text";
import type { Highlight } from "@/lib/use-highlights";

type EditableItem = {
  id: string;
  title: string;
  text: string;
};

type EditableSummarySectionProps = {
  title: string;
  items: EditableItem[];
  onSave: (items: EditableItem[]) => Promise<void>;
  canEdit?: boolean;
  className?: string;
  currentItemIndex?: number; // For paginated viewing
  itemLabel?: string; // e.g., "Chapter", "Key Idea"
  bookId?: string;
  section?: string;
  highlights?: Highlight[];
  onHighlightCreated?: () => void;
  onHighlightDeleted?: () => void;
};

export function EditableSummarySection({
  title,
  items,
  onSave,
  canEdit = false,
  className = "",
  currentItemIndex,
  itemLabel = "Item",
  bookId,
  section,
  highlights = [],
  onHighlightCreated,
  onHighlightDeleted,
}: EditableSummarySectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<EditableItem[]>(items);
  const [isSaving, setIsSaving] = useState(false);

  // Show multiple items per page (like a document) - show 5 items per page
  const ITEMS_PER_PAGE = 5;
  
  const getDisplayItems = () => {
    if (isEditing) {
      return editedItems;
    }
    
    // If currentItemIndex is provided, calculate page and show items for that page
    if (currentItemIndex !== undefined && currentItemIndex >= 0) {
      const page = Math.floor(currentItemIndex / ITEMS_PER_PAGE);
      const startIndex = page * ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, items.length);
      return items.slice(startIndex, endIndex);
    }
    
    // If no pagination, show all items
    return items;
  };
  
  const displayItems = getDisplayItems();

  const handleEdit = () => {
    setEditedItems([...items]);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedItems([...items]);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedItems);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleItemChange = (id: string, field: 'title' | 'text', value: string) => {
    setEditedItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddItem = () => {
    const newItem: EditableItem = {
      id: `new-${Date.now()}`,
      title: "New Item",
      text: "Enter content here..."
    };
    setEditedItems(prev => [...prev, newItem]);
  };

  const handleDeleteItem = (id: string) => {
    setEditedItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">
            {title.includes("(") ? title : (() => {
              if (isEditing) {
                return `${title} (${items.length})`;
              }
              if (currentItemIndex !== undefined && currentItemIndex >= 0) {
                const currentPage = Math.floor(currentItemIndex / ITEMS_PER_PAGE) + 1;
                const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
                const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
                const endItem = Math.min(currentPage * ITEMS_PER_PAGE, items.length);
                return `${title} (Page ${currentPage} of ${totalPages} - Items ${startItem}-${endItem} of ${items.length})`;
              }
              return `${title} (${items.length})`;
            })()}
          </CardTitle>
          {canEdit && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
          )}
          {canEdit && isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
      )}
      <CardContent className="space-y-6">
        {isEditing ? (
          <div className="space-y-6">
            {editedItems.map((item, index) => (
              <div key={item.id} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {itemLabel} {index + 1}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={item.title}
                  onChange={(e) => handleItemChange(item.id, 'title', e.target.value)}
                  placeholder="Enter title..."
                  className="font-semibold"
                />
                <Textarea
                  value={item.text}
                  onChange={(e) => handleItemChange(item.id, 'text', e.target.value)}
                  placeholder="Enter content..."
                  className="min-h-[120px] resize-none"
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={handleAddItem}
              className="w-full flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New {itemLabel}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {displayItems.length === 0 ? (
              <div className="text-center text-[rgb(var(--muted-foreground))] py-8">
                No items available
              </div>
            ) : (
              displayItems.map((item, displayIndex) => {
                // Calculate the actual index based on the page
                const page = currentItemIndex !== undefined && currentItemIndex >= 0
                  ? Math.floor(currentItemIndex / ITEMS_PER_PAGE)
                  : 0;
                const actualIndex = page * ITEMS_PER_PAGE + displayIndex;
                
                return (
                  <div key={item.id} className="mb-10 pb-10 border-b border-[rgb(var(--border))] last:border-b-0 last:mb-0 last:pb-0">
                    <h3 className="text-2xl font-semibold text-[rgb(var(--foreground))] mb-4">
                      {item.title}
                    </h3>
                    {bookId && section ? (
                      <HighlightableText
                        text={item.text}
                        bookId={bookId}
                        section={section}
                        itemIndex={actualIndex}
                        highlights={highlights}
                        onHighlightCreated={onHighlightCreated}
                        onHighlightDeleted={onHighlightDeleted}
                        className="text-[rgb(var(--foreground))] leading-7 whitespace-pre-wrap text-base"
                      />
                    ) : (
                      <SummaryText className="text-[rgb(var(--foreground))] leading-7 whitespace-pre-wrap text-base">
                        {item.text}
                      </SummaryText>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type EditableTextSectionProps = {
  title: string;
  content: string;
  onSave: (content: string) => Promise<void>;
  canEdit?: boolean;
  className?: string;
  bookId?: string;
  section?: string;
  itemIndex?: number;
  highlights?: Highlight[];
  onHighlightCreated?: () => void;
  onHighlightDeleted?: () => void;
};

export function EditableTextSection({
  title,
  content,
  onSave,
  canEdit = false,
  className = "",
  bookId,
  section,
  itemIndex = 0,
  highlights = [],
  onHighlightCreated,
  onHighlightDeleted,
}: EditableTextSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setEditedContent(content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedContent);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        {canEdit && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="flex items-center gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        )}
        {canEdit && isEditing && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[200px] resize-none"
            placeholder="Enter content..."
          />
        ) : (
          bookId && section ? (
            <HighlightableText
              text={content}
              bookId={bookId}
              section={section}
              itemIndex={itemIndex}
              highlights={highlights}
              onHighlightCreated={onHighlightCreated}
              onHighlightDeleted={onHighlightDeleted}
              className="text-[rgb(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap"
            />
          ) : (
            <SummaryText className="text-[rgb(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
              {content}
            </SummaryText>
          )
        )}
      </CardContent>
    </Card>
  );
}

type EditableListSectionProps = {
  title: string;
  items: string[];
  onSave: (items: string[]) => Promise<void>;
  canEdit?: boolean;
  className?: string;
  itemLabel?: string; // e.g., "Insight", "Quote"
  currentItemIndex?: number; // For paginated viewing
  bookId?: string;
  section?: string;
  highlights?: Highlight[];
  onHighlightCreated?: () => void;
  onHighlightDeleted?: () => void;
};

export function EditableListSection({
  title,
  items,
  onSave,
  canEdit = false,
  className = "",
  itemLabel = "Item",
  currentItemIndex,
  bookId,
  section,
  highlights = [],
  onHighlightCreated,
  onHighlightDeleted,
}: EditableListSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<string[]>(items);
  const [isSaving, setIsSaving] = useState(false);

  // Show multiple items per page (like a document) - show 5 items per page
  const ITEMS_PER_PAGE = 5;
  
  const getDisplayItems = () => {
    if (isEditing) {
      return editedItems;
    }
    
    // If currentItemIndex is provided, calculate page and show items for that page
    if (currentItemIndex !== undefined && currentItemIndex >= 0) {
      const page = Math.floor(currentItemIndex / ITEMS_PER_PAGE);
      const startIndex = page * ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, items.length);
      return items.slice(startIndex, endIndex);
    }
    
    // If no pagination, show all items
    return items;
  };
  
  const displayItems = getDisplayItems();

  const handleEdit = () => {
    setEditedItems([...items]);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedItems([...items]);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedItems);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleItemChange = (index: number, value: string) => {
    setEditedItems(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAddItem = () => {
    setEditedItems(prev => [...prev, ""]);
  };

  const handleDeleteItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">
          {(() => {
            if (isEditing) {
              return `${title} (${items.length})`;
            }
            if (currentItemIndex !== undefined && currentItemIndex >= 0) {
              const currentPage = Math.floor(currentItemIndex / ITEMS_PER_PAGE) + 1;
              const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
              const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
              const endItem = Math.min(currentPage * ITEMS_PER_PAGE, items.length);
              return `${title} (Page ${currentPage} of ${totalPages} - Items ${startItem}-${endItem} of ${items.length})`;
            }
            return `${title} (${items.length})`;
          })()}
        </CardTitle>
        {canEdit && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="flex items-center gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        )}
        {canEdit && isEditing && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isEditing ? (
          <div className="space-y-6">
            {editedItems.map((item, index) => (
              <div key={index} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {itemLabel} {index + 1}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  placeholder={`Enter ${itemLabel.toLowerCase()}...`}
                  className="min-h-[120px] resize-none"
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={handleAddItem}
              className="w-full flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New {itemLabel}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {displayItems.length === 0 ? (
              <div className="text-center text-[rgb(var(--muted-foreground))] py-8">
                No {itemLabel.toLowerCase()}s available
              </div>
            ) : (
              displayItems.map((item, displayIndex) => {
                // Calculate the actual index based on the page
                const page = currentItemIndex !== undefined && currentItemIndex >= 0
                  ? Math.floor(currentItemIndex / ITEMS_PER_PAGE)
                  : 0;
                const actualIndex = page * ITEMS_PER_PAGE + displayIndex;
                
                return (
                  <div key={actualIndex} className="mb-10 pb-10 border-b border-[rgb(var(--border))] last:border-b-0 last:mb-0 last:pb-0">
                    <Badge variant="secondary" className="text-xs mb-3">
                      {itemLabel} {actualIndex + 1}
                    </Badge>
                    {bookId && section ? (
                      <HighlightableText
                        text={item}
                        bookId={bookId}
                        section={section}
                        itemIndex={actualIndex}
                        highlights={highlights}
                        onHighlightCreated={onHighlightCreated}
                        onHighlightDeleted={onHighlightDeleted}
                        className="text-[rgb(var(--foreground))] leading-7 whitespace-pre-wrap text-base"
                      />
                    ) : (
                      <SummaryText className="text-[rgb(var(--foreground))] leading-7 whitespace-pre-wrap text-base">
                        {item.split('\n\n').map((paragraph, pIndex) => (
                          <p key={pIndex} className="mb-4">
                            {paragraph}
                          </p>
                        ))}
                      </SummaryText>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

