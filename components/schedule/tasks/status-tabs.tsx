"use client"

import React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FilterTab } from "./types"
import { EnumTodoStatus, todoStatusNamed } from "./enum"

interface StatusTabsProps {
  onTabChange: (tab: FilterTab) => void
  activeTab: FilterTab
}

const StatusTabs: React.FC<StatusTabsProps> = ({ onTabChange, activeTab }) => {
  return (
    <Tabs
      defaultValue={activeTab}
      onValueChange={(value) => onTabChange(value as FilterTab)}
      value={activeTab}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        {Object.values(EnumTodoStatus).map((status) => (
          <TabsTrigger key={status} value={status}>
            {todoStatusNamed[status]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

export default StatusTabs
