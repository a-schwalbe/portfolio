#include <memory.h>
#include <unistd.h>
#include <errno.h>
#include <stdlib.h>
#include <fcntl.h>
#include <iostream>
#include <stdio.h>
#include "page.h"
#include "buf.h"

#define ASSERT(c)  { if (!(c)) { \
		       cerr << "At line " << __LINE__ << ":" << endl << "  "; \
                       cerr << "This condition should hold: " #c << endl; \
                       exit(1); \
		     } \
                   }

//----------------------------------------
// Constructor of the class BufMgr
//----------------------------------------

BufMgr::BufMgr(const int bufs)
{
    numBufs = bufs;

    bufTable = new BufDesc[bufs];
    memset(bufTable, 0, bufs * sizeof(BufDesc));
    for (int i = 0; i < bufs; i++) 
    {
        bufTable[i].frameNo = i;
        bufTable[i].valid = false;
    }

    bufPool = new Page[bufs];
    memset(bufPool, 0, bufs * sizeof(Page));

    int htsize = ((((int) (bufs * 1.2))*2)/2)+1;
    hashTable = new BufHashTbl (htsize);  // allocate the buffer hash table

    clockHand = bufs - 1;
}


BufMgr::~BufMgr() {

    // flush out all unwritten pages
    for (int i = 0; i < numBufs; i++) 
    {
        BufDesc* tmpbuf = &bufTable[i];
        if (tmpbuf->valid == true && tmpbuf->dirty == true) {

#ifdef DEBUGBUF
            cout << "flushing page " << tmpbuf->pageNo
                 << " from frame " << i << endl;
#endif

            tmpbuf->file->writePage(tmpbuf->pageNo, &(bufPool[i]));
        }
    }

    delete hashTable;
    delete [] bufTable;
    delete [] bufPool;
}


const Status BufMgr::allocBuf(int & frame) 
{
    int pinned_count = 0;
    Status status;
    for(unsigned int i = 0; i < 2*numBufs; i++){
        advanceClock();
        BufDesc* current = &bufTable[clockHand];

        if(current->valid == false){
            frame = clockHand;
            return OK;
        }

        if (current->pinCnt > 0){
            pinned_count++;
            continue;
        }

        if(current->refbit == true){
            current->refbit = false;
            continue;
        }

        if(current->dirty == true){
            status = current->file->writePage(current->pageNo, &bufPool[clockHand]);

            if(status != OK){
                return status;
            }
            bufStats.diskwrites++;
        }

        status = hashTable->remove(current->file, current->pageNo);
        if(status != OK){
            return status;
        }

        current->Clear();
        current->refbit = false;
        frame = clockHand;
        return OK;
    }

    if(pinned_count >= (int)numBufs){
        return BUFFEREXCEEDED;
    }
    return BUFFEREXCEEDED;
}
	
const Status BufMgr::readPage(File* file, const int PageNo, Page*& page)
{

    Status status;
    int frameNo;
    bufStats.accesses++;

    status = hashTable->lookup(file, PageNo, frameNo);

    if(status == OK){
        bufTable[frameNo].pinCnt++;
        bufTable[frameNo].refbit = true;
        page = &bufPool[frameNo];
        return OK;      
    }

    if(status != HASHNOTFOUND){
        return status;
    }

    status = allocBuf(frameNo);
    if(status != OK){
        return status;
    }

    status = file->readPage(PageNo, &bufPool[frameNo]);
    if(status != OK){
        return status;
    }
    bufStats.diskreads++;

    status = hashTable->insert(file, PageNo, frameNo);
    if(status != OK){
        return status;
    }

    bufTable[frameNo].Set(file, PageNo);

    page = &bufPool[frameNo];
    return OK;
}


const Status BufMgr::unPinPage(File* file, const int PageNo, 
			       const bool dirty) 
{
    Status status;
    int frameNo;

    status = hashTable->lookup(file, PageNo, frameNo);

    if(status != OK){
        return status;
    }

    BufDesc* current = &bufTable[frameNo];

    if(current->pinCnt == 0){
        return PAGENOTPINNED;
    }

    current->pinCnt--;
    if(dirty == true){
        current->dirty = true;
    }
    return OK;
}

const Status BufMgr::allocPage(File* file, int& pageNo, Page*& page) 
{
    Status status;
    int frameNo;

    status = file->allocatePage(pageNo);
    if(status != OK){
        return status;
    }

    status = allocBuf(frameNo);
    if(status != OK){
        return status;
    }

    status = hashTable->insert(file, pageNo, frameNo);
    if(status != OK){
        return status;
    }

    bufTable[frameNo].Set(file, pageNo);

    page = &bufPool[frameNo];
    page->init(pageNo);

    return OK;

}

const Status BufMgr::disposePage(File* file, const int pageNo) 
{
    // see if it is in the buffer pool
    Status status = OK;
    int frameNo = 0;
    status = hashTable->lookup(file, pageNo, frameNo);
    if (status == OK)
    {
        // clear the page
        bufTable[frameNo].Clear();
    }
    status = hashTable->remove(file, pageNo);

    // deallocate it in the file
    return file->disposePage(pageNo);
}

const Status BufMgr::flushFile(const File* file) 
{
  Status status;

  for (int i = 0; i < numBufs; i++) {
    BufDesc* tmpbuf = &(bufTable[i]);
    if (tmpbuf->valid == true && tmpbuf->file == file) {

      if (tmpbuf->pinCnt > 0)
	  return PAGEPINNED;

      if (tmpbuf->dirty == true) {
#ifdef DEBUGBUF
	cout << "flushing page " << tmpbuf->pageNo
             << " from frame " << i << endl;
#endif
	if ((status = tmpbuf->file->writePage(tmpbuf->pageNo,
					      &(bufPool[i]))) != OK)
	  return status;

	tmpbuf->dirty = false;
      }

      hashTable->remove(file,tmpbuf->pageNo);

      tmpbuf->file = NULL;
      tmpbuf->pageNo = -1;
      tmpbuf->valid = false;
    }

    else if (tmpbuf->valid == false && tmpbuf->file == file)
      return BADBUFFER;
  }
  
  return OK;
}


void BufMgr::printSelf(void) 
{
    BufDesc* tmpbuf;
  
    cout << endl << "Print buffer...\n";
    for (int i=0; i<numBufs; i++) {
        tmpbuf = &(bufTable[i]);
        cout << i << "\t" << (char*)(&bufPool[i]) 
             << "\tpinCnt: " << tmpbuf->pinCnt;
    
        if (tmpbuf->valid == true)
            cout << "\tvalid\n";
        cout << endl;
    };
}


